const SITE = 'Modeer Almalaaeb';
// First match wins, so specific paths come before their parents (e.g. /rooms/new before /rooms/:id).
const TITLES = [
  [/^\/$/, 'Home'], [/^\/sports/, 'Find games'], [/^\/rooms\/new/, 'Host a room'], [/^\/rooms\/\d+\/edit/, 'Edit room'],
  [/^\/rooms\/\d+/, 'Room'], [/^\/my-rooms/, 'My rooms'], [/^\/joined-rooms/, 'Joined rooms'], [/^\/messages/, 'Messages'],
  [/^\/friends/, 'Friends'], [/^\/groups/, 'Groups'], [/^\/notifications/, 'Notifications'], [/^\/users\/\d+/, 'Profile'],
  [/^\/settings/, 'Settings'], [/^\/cups\/new/, 'Create a cup'], [/^\/cups\/\d+/, 'Cup'], [/^\/cups/, 'Cups'],
  [/^\/sign-in/, 'Sign in'], [/^\/sign-up/, 'Sign up'],
];

/** The document title for a route, so screen readers and tabs say where you are. */
export function routeTitle(pathname) {
  const match = TITLES.find(([pattern]) => pattern.test(pathname));
  return `${match ? match[1] : 'Page not found'} · ${SITE}`;
}
