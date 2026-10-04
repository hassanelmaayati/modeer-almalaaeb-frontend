/** Join resource names and identifiers without allowing an identifier to alter a URL. */
export function apiPath(...segments) {
  return `/${segments.map((segment) => encodeURIComponent(String(segment))).join('/')}`;
}
