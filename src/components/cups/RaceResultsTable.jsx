import { formatDuration } from '../../lib/helpers/cups';

const hasResult = entry => entry.did_not_finish || entry.position != null || entry.finish_time_seconds != null;

// Finishers by position, then by time; DNF and teams without a result go last.
function rank(a, b) {
  const group = entry => entry.did_not_finish ? 2 : hasResult(entry) ? 0 : 1;
  return group(a) - group(b)
    || (a.position ?? Infinity) - (b.position ?? Infinity)
    || (a.finish_time_seconds ?? Infinity) - (b.finish_time_seconds ?? Infinity);
}

export default function RaceResultsTable({ entries }) {
  if (!entries.length) return <p>No accepted teams yet.</p>;
  if (!entries.some(hasResult)) return <p>No results yet.</p>;
  return <table className="race-results">
    <thead><tr><th>Team</th><th>Position</th><th>Time</th></tr></thead>
    <tbody>
      {[...entries].sort(rank).map(entry => <tr key={entry.group_id}>
        <td>{entry.group_name}</td>
        <td>{entry.did_not_finish ? 'DNF' : entry.position ?? '—'}</td>
        <td>{entry.did_not_finish ? '—' : formatDuration(entry.finish_time_seconds) || '—'}</td>
      </tr>)}
    </tbody>
  </table>;
}
