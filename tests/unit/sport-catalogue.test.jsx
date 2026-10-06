import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import SportIcon from '../../src/components/common/SportIcon';
import SportPicker from '../../src/components/home/SportPicker';
import HomeGameCard from '../../src/components/home/HomeGameCard';

const catalogue = [
  'Football', 'Basketball', 'Padel', 'Swimming', 'Walking',
  'Running', 'Cycling', 'Handball', 'Billiards', 'Kayak',
].map((name, index) => ({ id: index + 1, name }));
const supportedNames = [...catalogue.map(sport => sport.name), 'Tennis', 'Marathon'];

function iconMarkup(name) {
  const view = render(<SportIcon name={name} />);
  const markup = view.container.querySelector('svg').innerHTML;
  view.unmount();
  return markup;
}

describe('live and previously supported sport icons', () => {
  it.each(supportedNames)('shows a sport-specific icon for %s with normalized case and spaces', name => {
    const icon = iconMarkup(name);
    expect(icon).not.toBe(iconMarkup('Unknown activity'));
    expect(icon).toBe(iconMarkup(`  ${name.toUpperCase()}  `));
  });

  it.each([
    ['Marathon', 'Running'],
    ['Kayak', 'Kayaking'],
  ])('uses the existing %s activity icon consistently with %s', (name, alias) => {
    expect(iconMarkup(name)).toBe(iconMarkup(alias));
  });

  it.each([
    ['unknown sport', 'A future sport'],
    ['blank name', '   '],
    ['missing name', undefined],
    ['null name', null],
    ['prototype object', '__proto__'],
    ['inherited constructor', 'constructor'],
    ['inherited method', 'toString'],
    ['inherited legacy getter', '__definegetter__'],
    ['numeric value', 12],
    ['function value', () => 'Football'],
    ['object value', { toString() { throw new Error('Do not coerce malformed sport data'); } }],
  ])('renders the generic fallback safely for %s', (_scenario, name) => {
    const fallback = iconMarkup('Unknown activity');
    expect(iconMarkup(name)).toBe(fallback);
  });

  it('keeps decorative icons hidden while preserving requested sizing and classes', () => {
    const view = render(<SportIcon name="Kayak" size={54} className="game-card-icon" />);
    const icon = view.container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('focusable', 'false');
    expect(icon).toHaveAttribute('width', '54');
    expect(icon).toHaveAttribute('height', '54');
    expect(icon).toHaveClass('sport-icon', 'game-card-icon');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('sport catalogue in redesigned discovery', () => {
  it('shows every live sport with a matching icon and a shareable filter link', () => {
    const icons = new Map(catalogue.map(sport => [sport.name, iconMarkup(sport.name)]));
    render(<MemoryRouter><SportPicker sports={catalogue} loading={false} /></MemoryRouter>);
    const picker = screen.getByRole('region', { name: 'Choose your sport' });
    expect(within(picker).getAllByRole('link')).toHaveLength(catalogue.length);
    for (const sport of catalogue) {
      const link = within(picker).getByRole('link', { name: sport.name, exact: true });
      expect(link).toHaveAttribute('href', `/sports?sport_id=${sport.id}`);
      expect(link.querySelector('svg').innerHTML).toBe(icons.get(sport.name));
    }
  });

  it('encodes catalogue identifiers without changing the displayed sport name', () => {
    const sport = { id: 'kayak/route?open&area=sea', name: 'Kayak' };
    render(<MemoryRouter><SportPicker sports={[sport]} loading={false} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Kayak' })).toHaveAttribute('href', `/sports?sport_id=${encodeURIComponent(sport.id)}`);
  });

  it.each(supportedNames)('uses the %s catalogue icon on a preview card and opens the exact room', async name => {
    const expectedIcon = iconMarkup(name);
    const room = {
      id: 101, title: `${name} with friends`, area: 'Manama',
      starts_at: '2030-10-10T15:00:00Z', admission_policy: 'open', slots_left: 3,
    };
    const onPreview = vi.fn();
    const user = userEvent.setup();
    render(<HomeGameCard room={room} sportName={name} onPreview={onPreview} />);
    const card = screen.getByRole('article');
    expect(card.querySelector('svg.sport-icon').innerHTML).toBe(expectedIcon);
    expect(within(card).getByText('3 players needed')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: `View game: ${room.title}` }));
    expect(onPreview).toHaveBeenCalledExactlyOnceWith(room);
  });
});
