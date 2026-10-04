export function returnDestination(locationState) {
  const destination = locationState?.from;
  return typeof destination === 'string' && destination.startsWith('/') &&
    !destination.startsWith('//') && !destination.startsWith('/sign-') ? destination : '/';
}
