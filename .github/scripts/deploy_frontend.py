"""Deploy the tested main commit; --self-test never invokes Vercel or the network."""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
from ci_gate import require_success

REQUIRED = ["configuration", "frontend", "fullstack", "gate"]
SECRETS = ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"]
PRODUCTION_API = "https://modeer-almalaaeb-backend.onrender.com/api/v1"


class DeploymentDenied(ValueError):
    pass


def require_eligible(context, main_sha):
    for key, expected in (("GITHUB_EVENT_NAME", "push"), ("GITHUB_REF", "refs/heads/main"),
                          ("VERCEL_DEPLOY_ENABLED", "true")):
        if context.get(key) != expected:
            raise DeploymentDenied(f"{key} does not permit production deployment")
    try:
        require_success(json.loads(context.get("CI_JOB_RESULTS", "null")), REQUIRED)
    except (ValueError, TypeError) as error:
        raise DeploymentDenied(str(error)) from error
    for key in ("GITHUB_SHA", "MODEER_TESTED_BACKEND_SHA"):
        if not re.fullmatch(r"[0-9a-f]{40}", context.get(key, "")):
            raise DeploymentDenied(f"Missing immutable {key}")
    if context["GITHUB_SHA"] != main_sha:
        raise DeploymentDenied("Tested commit is no longer main's head")
    if any(not context.get(key) for key in SECRETS):
        raise DeploymentDenied("Production Vercel credentials are incomplete")


def read_production_api():
    file = Path(".vercel/.env.production.local")
    if not file.is_file():
        raise DeploymentDenied("Vercel did not provide its production environment file")
    values = []
    for line in file.read_text(encoding="utf-8").splitlines():
        key, separator, raw = line.strip().partition("=")
        if separator and key == "VITE_API_BASE_URL":
            try:
                parsed = shlex.split(raw, comments=True, posix=True)
            except ValueError as error:
                raise DeploymentDenied("Invalid production VITE_API_BASE_URL setting") from error
            values.append(parsed[0] if len(parsed) == 1 else "")
    if len(values) != 1:
        raise DeploymentDenied("Production VITE_API_BASE_URL is missing or duplicated")
    return values[0]


def execute(context, get_main_sha, run, get_production_api):
    require_eligible(context, get_main_sha())
    actual_sha = run(["git", "rev-parse", "HEAD"], capture_output=True).stdout.strip()
    if actual_sha != context["GITHUB_SHA"]:
        raise DeploymentDenied("Checked out source is not the tested commit")
    token = context["VERCEL_TOKEN"]
    run(["vercel", "pull", "--yes", "--environment=production", f"--token={token}"])
    if get_production_api().rstrip("/") != PRODUCTION_API:
        raise DeploymentDenied(f"Production VITE_API_BASE_URL must be {PRODUCTION_API}")
    require_eligible(context, get_main_sha())
    run(["vercel", "build", "--prod", f"--token={token}"])
    require_eligible(context, get_main_sha())
    run(["vercel", "deploy", "--prebuilt", "--prod", "--yes", f"--token={token}",
         "--meta", f"testedFrontendSha={context['GITHUB_SHA']}",
         "--meta", f"testedBackendSha={context['MODEER_TESTED_BACKEND_SHA']}"])


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.sha = "a" * 40
        self.context = {"GITHUB_EVENT_NAME": "push", "GITHUB_REF": "refs/heads/main",
                        "VERCEL_DEPLOY_ENABLED": "true", "GITHUB_SHA": self.sha,
                        "MODEER_TESTED_BACKEND_SHA": "b" * 40,
                        "CI_JOB_RESULTS": json.dumps({key: {"result": "success"} for key in REQUIRED}),
                        **{key: "fixture-value" for key in SECRETS}}

    def run_policy(self, changes=None, main_sha=None):
        context = {**self.context, **(changes or {})}
        calls = []
        def stub(command, **kwargs):
            calls.append(command)
            return Mock(stdout=self.sha + "\n")
        execute(context, lambda: main_sha or self.sha, stub, lambda: PRODUCTION_API)
        return calls

    def test_eligible_success_deploys_exactly_once(self):
        calls = self.run_policy()
        deployments = [call for call in calls if call[:2] == ["vercel", "deploy"]]
        self.assertEqual(len(deployments), 1)
        self.assertIn("--prebuilt", deployments[0])
        self.assertIn(f"testedFrontendSha={self.sha}", deployments[0])

    def test_ineligible_cases_never_call_the_executor(self):
        cases = [{"GITHUB_EVENT_NAME": "pull_request"}, {"GITHUB_EVENT_NAME": "workflow_dispatch"},
                 {"GITHUB_REF": "refs/heads/feature"},
                 {"VERCEL_DEPLOY_ENABLED": "false"}, {"MODEER_TESTED_BACKEND_SHA": ""},
                 {"CI_JOB_RESULTS": "{}"}]
        cases += [{key: ""} for key in SECRETS]
        for result in ("failure", "skipped", "cancelled", "neutral"):
            for job in REQUIRED:
                results = {key: {"result": "success"} for key in REQUIRED}
                results[job]["result"] = result
                cases.append({"CI_JOB_RESULTS": json.dumps(results)})
        for changes in cases:
            with self.subTest(changes=changes):
                stub = Mock()
                with self.assertRaises(DeploymentDenied):
                    execute({**self.context, **changes}, lambda: self.sha, stub, lambda: PRODUCTION_API)
                stub.assert_not_called()

    def test_stale_commit_never_calls_executor(self):
        stub = Mock()
        with self.assertRaises(DeploymentDenied):
            execute(self.context, lambda: "c" * 40, stub, lambda: PRODUCTION_API)
        stub.assert_not_called()

    def test_wrong_checkout_never_calls_vercel(self):
        stub = Mock(return_value=Mock(stdout="d" * 40))
        with self.assertRaises(DeploymentDenied):
            execute(self.context, lambda: self.sha, stub, lambda: PRODUCTION_API)
        self.assertEqual(stub.call_count, 1)

    def test_main_moves_during_build_and_upload_is_blocked(self):
        calls = []
        heads = iter([self.sha, self.sha, "c" * 40])
        def stub(command, **kwargs):
            calls.append(command)
            return Mock(stdout=self.sha)
        with self.assertRaises(DeploymentDenied):
            execute(self.context, lambda: next(heads), stub, lambda: PRODUCTION_API)
        self.assertFalse(any(call[:2] == ["vercel", "deploy"] for call in calls))

    def test_missing_or_wrong_production_api_never_builds_or_deploys(self):
        with patch.object(Path, "is_file", return_value=False):
            with self.assertRaises(DeploymentDenied):
                read_production_api()
        for content in (f'VITE_API_BASE_URL="{PRODUCTION_API}"\n',
                        f"VITE_API_BASE_URL={PRODUCTION_API}\n",
                        f"VITE_API_BASE_URL='{PRODUCTION_API}' # fixture comment\n"):
            with self.subTest(content=content), patch.object(Path, "is_file", return_value=True), \
                    patch.object(Path, "read_text", return_value=content):
                self.assertEqual(read_production_api(), PRODUCTION_API)
        for content in ("OTHER_KEY=fixture\n", "VITE_API_BASE_URL='unterminated\n",
                        f"VITE_API_BASE_URL={PRODUCTION_API}\nVITE_API_BASE_URL={PRODUCTION_API}\n"):
            with self.subTest(content=content), patch.object(Path, "is_file", return_value=True), \
                    patch.object(Path, "read_text", return_value=content):
                with self.assertRaises(DeploymentDenied):
                    read_production_api()
        for value in ("", "/api/v1", "https://wrong.example/api/v1", PRODUCTION_API + "/extra"):
            with self.subTest(value=value):
                calls = []
                def stub(command, **kwargs):
                    calls.append(command)
                    return Mock(stdout=self.sha)
                with self.assertRaises(DeploymentDenied):
                    execute(self.context, lambda: self.sha, stub, lambda: value)
                self.assertFalse(any(call[:2] in (["vercel", "build"], ["vercel", "deploy"]) for call in calls))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(DeploymentTests)
        return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1
    def run(command, **kwargs):
        return subprocess.run(command, check=True, text=True, **kwargs)
    def get_main_sha():
        result = run(["git", "ls-remote", "--exit-code", "--heads", "origin", "refs/heads/main"],
                     capture_output=True, timeout=60)
        rows = result.stdout.strip().splitlines()
        if len(rows) != 1 or not re.fullmatch(r"[0-9a-f]{40}\s+refs/heads/main", rows[0]):
            raise DeploymentDenied("Cannot verify the current main commit")
        return rows[0].split()[0]
    try:
        execute(dict(os.environ), get_main_sha, run, read_production_api)
    except DeploymentDenied as error:
        parser.exit(1, f"No deployment: {error}\n")
    except subprocess.CalledProcessError as error:
        # Do not include the token-bearing command line in a traceback.
        parser.exit(1, f"Deployment pipeline failed with exit code {error.returncode}.\n")
    except subprocess.TimeoutExpired:
        parser.exit(1, "No deployment: current main verification timed out.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
