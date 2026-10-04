export function roomPositions(room) {
  const layout = room.slot_layout || {};
  const positions = layout.slots || layout.positions || layout.teams?.flatMap(team => team.slots || []) || [];
  if (!Array.isArray(positions) || !positions.length) return Array.from({ length: room.capacity }, (_, index) => ({ value: String(index + 1), label: `Place ${index + 1}` }));
  return positions.map(position => typeof position === 'object'
    ? { value: String(position.id ?? position.key ?? position.position ?? ''), label: position.label || position.name || String(position.id ?? position.key ?? position.position ?? '') }
    : { value: String(position), label: String(position) }).filter(position => position.value);
}
