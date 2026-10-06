import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CupPage from '../../src/pages/CupPage';
import CupsPage from '../../src/pages/CupsPage';
import CupHeader from '../../src/components/cups/CupHeader';
import CupStatusFilters from '../../src/components/cups/CupStatusFilters';
import CupForm from '../../src/components/cups/CupForm';
import CupOrganizerActions from '../../src/components/cups/CupOrganizerActions';
import FixtureResultControls from '../../src/components/cups/FixtureResultControls';
import RaceResultsForm from '../../src/components/cups/RaceResultsForm';
import RaceResultsTable from '../../src/components/cups/RaceResultsTable';
import KnockoutBracket from '../../src/components/cups/KnockoutBracket';
import { cupSports, eligibleGroups, formatDuration, parseDuration, publishBlocker, registrationClosed, sportFormat, STALE_CUP_MESSAGE } from '../../src/lib/helpers/cups';
import cupService from '../../src/services/cupService';
import sportService from '../../src/services/sportService';
import groupService from '../../src/services/groupService';
import cupRosterService from '../../src/services/cupRosterService';
import userService from '../../src/services/userService';

vi.mock('../../src/services/cupService', () => ({ default: { list: vi.fn(), get: vi.fn(), update: vi.fn(), remove: vi.fn(), createEntry: vi.fn(), updateEntry: vi.fn() } }));
vi.mock('../../src/services/cupRosterService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/userService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/sportService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/groupService', () => ({ default: { list: vi.fn() } }));
const now = Date.parse('2030-01-01T12:00:00Z');
const sports = [{ id: 1, name: 'Football', cup_format: 'knockout' }, { id: 2, name: 'Running', cup_format: 'race' }, { id: 3, name: 'Walking', cup_format: null }];
const entries = [1, 2, 3, 4].map(group_id => ({ group_id, group_name: 'Team ' + group_id, owner_user_id: group_id + 1, status: 'accepted', entered_at: '2030-01-01T11:00:00Z' }));
const cup = { id: 1, revision: 3, name: 'Winter cup', rules: 'Play fairly', sport_id: 1, format: 'knockout', status: 'registration', team_count: 4, roster_limit: 5, registration_closes_at: '2030-01-02T12:00:00Z', organizer: { id: 1, user_name: 'Alice' }, entries, fixtures: [] };
const addedSports = [
  { id: 5, name: 'Walking', formats: null, cup_format: null },
  { id: 6, name: 'Running', formats: null, cup_format: 'race' },
  { id: 7, name: 'Cycling', formats: null, cup_format: 'race' },
  { id: 8, name: 'Handball', formats: null, cup_format: 'knockout' },
  { id: 9, name: 'Billiards', formats: null, cup_format: 'knockout' },
  { id: 10, name: 'Kayak', formats: null, cup_format: 'race' },
  { id: 3, name: 'Padel', formats: null, cup_format: 'knockout' },
  { id: 4, name: 'Swimming', formats: null, cup_format: 'race' },
  { id: 11, name: 'Marathon', formats: null, cup_format: 'race' },
];
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  cupService.get.mockReset().mockResolvedValue(cup);
  cupService.update.mockReset().mockResolvedValue({ ...cup, status: 'published', revision: 4 });
  cupService.remove.mockReset().mockResolvedValue(null);
  cupService.createEntry.mockReset().mockResolvedValue(cup);
  cupService.updateEntry.mockReset().mockResolvedValue(cup);
  sportService.list.mockReset().mockResolvedValue(sports);
  groupService.list.mockReset().mockResolvedValue([]);
  cupRosterService.list.mockReset().mockResolvedValue([]);
  userService.list.mockReset().mockResolvedValue([]);
  cupService.list.mockReset().mockResolvedValue([]);
});
function show(data = cup, user = { id: 1 }) {
  cupService.get.mockResolvedValue(data);
  return render(<MemoryRouter initialEntries={['/cups/1']}><Routes><Route path="/cups/:cupId" element={<CupPage session={{ user }} />} /><Route path="/cups" element={<p>Cup catalogue</p>} /></Routes></MemoryRouter>);
}

describe('cup sport, registration and participant rules', () => {
  it.each([['knockout', 'knockout'], ['race', 'race'], [null, null], [undefined, null], ['league', null]])('uses the backend cup_format %s', (value, expected) => expect(sportFormat({ name: 'Football', cup_format: value })).toBe(expected));
  it('no longer guesses a cup format from the sport name', () => expect(sportFormat({ name: 'Football' })).toBeNull());
  it('requires exactly the knockout bracket size and at least two accepted race teams', () => {
    expect(publishBlocker(cup)).toBe('');
    expect(publishBlocker({ ...cup, entries: entries.slice(0, 3) })).toMatch(/exactly 4 accepted teams/);
    expect(publishBlocker({ ...cup, entries: [...entries, { group_id: 5, status: 'accepted' }] })).toMatch(/exactly 4/);
    expect(publishBlocker({ ...cup, format: 'race', entries: entries.slice(0, 1) })).toMatch(/at least 2/);
    expect(publishBlocker({ ...cup, format: 'race', entries: entries.slice(0, 2) })).toBe('');
  });
  it('offers only owned groups for the matching sport without a pending or accepted place', () => {
    const groups = [
      { id: 1, owner_id: 1, sports_id: 1 }, { id: 8, owner_id: 1, sports_id: 1 },
      { id: 9, owner_id: 2, sports_id: 1 }, { id: 10, owner_id: 1, sports_id: 2 },
    ];
    expect(eligibleGroups(groups, cup, 1).map(group => group.id)).toEqual([8]);
    expect(eligibleGroups(groups, { ...cup, entries: [{ group_id: 1, status: 'withdrawn' }] }, 1).map(group => group.id)).toEqual([1, 8]);
  });
  it('closes registration exactly at its configured deadline', () => {
    expect(registrationClosed({ registration_closes_at: new Date(now + 1).toISOString() })).toBe(false);
    expect(registrationClosed({ registration_closes_at: new Date(now).toISOString() })).toBe(true);
  });
  it.each([['42:10', 2530], ['1:02:30', 3750], ['12.5', 12.5], ['bad', NaN]])('parses race duration %s', (value, seconds) => expect(parseDuration(value)).toBe(seconds));
  it('renders fractional and multi-hour race times', () => {
    expect(formatDuration(3750)).toBe('1:02:30');
    expect(formatDuration(12.5)).toBe('0:12.50');
    expect(formatDuration(null)).toBe('');
  });
});

describe('cup and result forms', () => {
  it('uses sport-derived format, valid knockout sizes and UTC registration time on create', async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(<CupForm sports={sports} onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(screen.queryByRole('option', { name: 'Walking' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: '1' } });
    expect(within(screen.getByLabelText('Number of teams')).getAllByRole('option').map(option => option.value)).toEqual(['4', '8', '16']);
    fireEvent.change(screen.getByLabelText('Cup name'), { target: { value: ' Winter cup ' } });
    fireEvent.change(screen.getByLabelText('Rules'), { target: { value: ' Play fairly ' } });
    fireEvent.change(screen.getByLabelText('Players per team (roster limit)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Registration closes (Bahrain time, optional)'), { target: { value: '2030-01-02T15:00' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create cup' }).closest('form'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Winter cup', rules: 'Play fairly', team_count: 4, roster_limit: 5, registration_closes_at: '2030-01-02T12:00:00.000Z', sport_id: 1 }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('format');
  });
  it('keeps the sport immutable on edit and retains values after backend failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Cup validation failed'));
    render(<CupForm cup={cup} sports={sports} onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText('Sport')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cup name'), { target: { value: 'Keep this edit' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cup validation failed');
    expect(screen.getByLabelText('Cup name')).toHaveValue('Keep this edit');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('sport_id');
  });
  it('offers race count bounds and disables creation without a supported format', () => {
    render(<CupForm sports={sports} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Create cup' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: '2' } });
    expect(screen.getByLabelText('Number of teams (2–100)')).toHaveAttribute('min', '2');
    expect(screen.getByLabelText('Number of teams (2–100)')).toHaveAttribute('max', '100');
  });
  it('requires a future deadline before opening registration', () => {
    const onUpdate = vi.fn();
    render(<CupOrganizerActions cup={{ ...cup, status: 'draft' }} sports={sports} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open registration…' }));
    fireEvent.change(screen.getByLabelText('Registration closes (Bahrain time, optional)'), { target: { value: '2030-01-01T15:00' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Open registration' }).closest('form'));
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a closing time in the future.');
    expect(onUpdate).not.toHaveBeenCalled();
  });
  it('asks for an explicit knockout draw winner and sends that group with the scores', async () => {
    const onRecord = vi.fn().mockResolvedValue(null);
    render(<FixtureResultControls fixture={{ id: 'final', home_group_id: 1, away_group_id: 2 }} homeName="Home" awayName="Away" onRecord={onRecord} />);
    fireEvent.change(screen.getByLabelText('Home'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Away'), { target: { value: '1' } });
    expect(screen.getByLabelText('Winner')).toBeRequired();
    fireEvent.change(screen.getByLabelText('Winner'), { target: { value: '2' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save result' }).closest('form'));
    await waitFor(() => expect(onRecord).toHaveBeenCalledWith({ fixture_id: 'final', home_score: 1, away_score: 1, winner_group_id: 2 }));
  });
  it('makes DNF override a typed time and prevents mixing positions with times', async () => {
    const onRecord = vi.fn().mockResolvedValue(null);
    render(<RaceResultsForm entries={entries.slice(0, 2)} onRecord={onRecord} />);
    fireEvent.change(screen.getByLabelText('Team 1 time'), { target: { value: '42:10' } });
    fireEvent.click(screen.getByLabelText('Team 1 did not finish'));
    fireEvent.change(screen.getByLabelText('Team 2 time'), { target: { value: '43:00' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save results' }).closest('form'));
    await waitFor(() => expect(onRecord).toHaveBeenCalledWith([{ group_id: 1, did_not_finish: true }, { group_id: 2, finish_time_seconds: 2580 }]));
    fireEvent.click(screen.getByLabelText('Position'));
    expect(screen.getByLabelText('Team 1 position')).toHaveValue(null);
    expect(screen.queryByLabelText('Team 1 time')).not.toBeInTheDocument();
  });
  it('refuses an invalid race duration without sending a result', () => {
    const onRecord = vi.fn();
    render(<RaceResultsForm entries={entries.slice(0, 1)} onRecord={onRecord} />);
    fireEvent.change(screen.getByLabelText('Team 1 time'), { target: { value: 'not a time' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save results' }).closest('form'));
    expect(screen.getByRole('alert')).toHaveTextContent('Team 1: enter a time');
    expect(onRecord).not.toHaveBeenCalled();
  });
  it('orders race finishers before missing results and DNF without mutating entries', () => {
    const data = [{ ...entries[0], did_not_finish: true }, { ...entries[1], finish_time_seconds: 20 }, { ...entries[2], finish_time_seconds: 10 }, entries[3]];
    render(<RaceResultsTable entries={data} />);
    expect(screen.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[0].textContent)).toEqual(['Team 3', 'Team 2', 'Team 4', 'Team 1']);
    expect(data[0].group_id).toBe(1);
  });
  it('provides result controls only for a ready, unplayed organizer fixture', () => {
    render(<KnockoutBracket entries={entries} canRecord fixtures={[
      { id: 'played', round: 1, match: 1, home_group_id: 1, away_group_id: 2, home_score: 2, away_score: 1, winner_group_id: 1 },
      { id: 'waiting', round: 2, match: 1, home_group_id: 1, away_group_id: null },
      { id: 'ready', round: 1, match: 2, home_group_id: 3, away_group_id: 4 },
    ]} onRecord={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: 'Save result' })).toHaveLength(1);
    expect(screen.getByText('TBD')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Final' })).toBeVisible();
  });
});

describe('new deployed sport cup eligibility', () => {
  it.each([['Walking', null], ['Running', 'race'], ['Marathon', 'race'], ['Cycling', 'race'], ['Handball', 'knockout'], ['Billiards', 'knockout'], ['Kayak', 'race'], ['Padel', 'knockout'], ['Swimming', 'race']])('derives the approved %s cup policy independently of null room formats', (name, format) => {
    expect(sportFormat(addedSports.find(sport => sport.name === name))).toBe(format);
    // The name alone no longer decides anything; only cup_format does.
    expect(sportFormat({ name, formats: null })).toBeNull();
  });
  it('offers every supported current and legacy competition while leaving Walking out', () => {
    expect(cupSports(addedSports).map(sport => sport.id)).toEqual([6, 7, 8, 9, 10, 3, 4, 11]);
    render(<CupForm sports={addedSports} onSubmit={vi.fn()} />);
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Select a sport', 'Running', 'Cycling', 'Handball', 'Billiards', 'Kayak', 'Padel', 'Swimming', 'Marathon']);
    expect(screen.queryByRole('option', { name: 'Walking' })).not.toBeInTheDocument();
  });
  it.each([['Running', 'race', 3, 1], ['Marathon', 'race', 3, 1], ['Cycling', 'race', 3, 1], ['Handball', 'knockout', 4, 7], ['Billiards', 'knockout', 4, 1], ['Kayak', 'race', 3, 1], ['Padel', 'knockout', 4, 2], ['Swimming', 'race', 3, 1]])('creates a %s cup using its server-derived format and valid team count controls', async (name, format, teamCount, rosterLimit) => {
    const sport = addedSports.find(item => item.name === name);
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(<CupForm sports={addedSports} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: String(sport.id) } });
    expect(screen.getByText(`Format: ${format === 'race' ? 'Race' : 'Knockout'}`)).toBeVisible();
    const teams = screen.getByLabelText(format === 'race' ? 'Number of teams (2–100)' : 'Number of teams');
    if (format === 'race') {
      expect(teams).toHaveAttribute('min', '2'); expect(teams).toHaveAttribute('max', '100');
      fireEvent.change(teams, { target: { value: String(teamCount) } });
    } else expect(within(teams).getAllByRole('option').map(option => option.value)).toEqual(['4', '8', '16']);
    fireEvent.change(screen.getByLabelText('Cup name'), { target: { value: `${name} event` } });
    fireEvent.change(screen.getByLabelText('Rules'), { target: { value: 'Play fairly' } });
    fireEvent.change(screen.getByLabelText('Players per team (roster limit)'), { target: { value: String(rosterLimit) } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create cup' }).closest('form'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: `${name} event`, rules: 'Play fairly', team_count: teamCount, roster_limit: rosterLimit, registration_closes_at: null, sport_id: sport.id }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('format');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('formats');
  });
});

describe('cup page role controls and stale revision recovery', () => {
  it.each(['draft', 'registration'])('shows organizer actions in %s only to its organizer', async status => {
    show({ ...cup, status }, { id: 2 });
    await screen.findByRole('heading', { name: 'Winter cup' });
    expect(screen.queryByRole('heading', { name: 'Organizer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish cup' })).not.toBeInTheDocument();
  });
  it.each(['published', 'completed'])('removes editing and deletion controls for %s', async status => {
    show({ ...cup, status });
    await screen.findByRole('heading', { name: 'Winter cup' });
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete cup' })).not.toBeInTheDocument();
  });
  it('does not load private group choices for guests and offers sign-in for registration', async () => {
    show(cup, null);
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(groupService.list).not.toHaveBeenCalled();
  });
  it('reloads a conflicting revision before allowing another publish attempt', async () => {
    cupService.update.mockRejectedValueOnce({ status: 409 });
    show();
    await screen.findByRole('button', { name: 'Publish cup' });
    cupService.get.mockResolvedValue({ ...cup, revision: 4 });
    fireEvent.click(screen.getByRole('button', { name: 'Publish cup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(STALE_CUP_MESSAGE);
    await waitFor(() => expect(cupService.get).toHaveBeenCalledTimes(2));
    expect(cupService.update).toHaveBeenCalledWith(1, { status: 'published', revision: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Publish cup' }));
    await waitFor(() => expect(cupService.update).toHaveBeenLastCalledWith(1, { status: 'published', revision: 4 }));
  });
  it('explains a private draft/not-found response without exposing cup content', async () => {
    cupService.get.mockRejectedValue({ status: 404 });
    render(<MemoryRouter initialEntries={['/cups/1']}><Routes><Route path="/cups/:cupId" element={<CupPage session={{ user: { id: 2 } }} />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Draft cups are only visible to their organizer.');
    expect(screen.queryByRole('heading', { name: 'Winter cup' })).not.toBeInTheDocument();
  });
});

describe('backend audit contract on cup pages', () => {
  it('shows the backend 409 reason and reloads the cup', async () => {
    cupService.update.mockRejectedValueOnce({ status: 409, message: 'All team places are taken' });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Publish cup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('All team places are taken');
    await waitFor(() => expect(cupService.get).toHaveBeenCalledTimes(2));
  });
  it('sends the current revision when reviewing an entry', async () => {
    show({ ...cup, entries: [...entries, { group_id: 7, group_name: 'Late team', owner_user_id: 1, status: 'pending', entered_at: '2030-01-01T11:30:00Z' }] });
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(cupService.updateEntry).toHaveBeenCalledWith(1, 7, { status: 'accepted', revision: 3 }));
  });
  it('lists accepted rosters read-only under their team', async () => {
    cupRosterService.list.mockResolvedValue([
      { id: 1, user_id: 20, group_id: 1, cup_id: 1, status: 'accepted' },
      { id: 2, user_id: 21, group_id: 1, cup_id: 1, status: 'pending' },
    ]);
    userService.list.mockResolvedValue([{ id: 20, user_name: 'Sara' }, { id: 21, user_name: 'Invited only' }]);
    show();
    const roster = await screen.findByRole('list', { name: 'Roster' });
    expect(within(roster).getByRole('link', { name: 'Sara' })).toHaveAttribute('href', '/users/20');
    expect(screen.queryByText('Invited only')).not.toBeInTheDocument();
    expect(cupRosterService.list).toHaveBeenCalledWith('1', expect.anything());
  });
  it('requires a closing time when editing a cup whose registration is open', async () => {
    const onSubmit = vi.fn();
    render(<CupForm cup={cup} sports={sports} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Registration closes (Bahrain time, optional)'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Registration is open, so a closing time is required.');
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('hides the Draft filter from guests only', () => {
    const { rerender } = render(<CupStatusFilters value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Draft' })).not.toBeInTheDocument();
    rerender(<CupStatusFilters value="" onChange={vi.fn()} signedIn />);
    expect(screen.getByRole('button', { name: 'Draft' })).toBeVisible();
  });
  it.each([['registration', true], ['draft', true], ['published', false], ['completed', false]])('shows the registration deadline for a %s cup: %s', (status, visible) => {
    render(<MemoryRouter><CupHeader cup={{ ...cup, status }} sportName="Football" /></MemoryRouter>);
    expect(!!screen.queryByText('Registration closes')).toBe(visible);
  });
  it('pages the cup list with Load more', async () => {
    const page = (start, count) => Array.from({ length: count }, (_, index) => ({ ...cup, id: start + index, name: `Cup ${start + index}` }));
    cupService.list.mockResolvedValueOnce(page(1, 50)).mockResolvedValueOnce(page(51, 2));
    render(<MemoryRouter><CupsPage session={{ user: null }} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Cup 52')).toBeVisible();
    expect(cupService.list.mock.calls.map(([query]) => query)).toEqual([{ status: '', limit: 50, offset: 0 }, { status: '', limit: 50, offset: 50 }]);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
