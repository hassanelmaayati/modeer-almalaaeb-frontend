import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import cupService from '../services/cupService';
import sportService from '../services/sportService';
import groupService from '../services/groupService';
import AsyncState from '../components/common/AsyncState';
import CupHeader from '../components/cups/CupHeader';
import CupOrganizerActions from '../components/cups/CupOrganizerActions';
import EntryList from '../components/cups/EntryList';
import EntryRosterControls from '../components/cups/EntryRosterControls';
import KnockoutBracket from '../components/cups/KnockoutBracket';
import RaceResultsTable from '../components/cups/RaceResultsTable';
import RaceResultsForm from '../components/cups/RaceResultsForm';
import { STALE_CUP_MESSAGE, acceptedEntries, eligibleGroups, isActiveEntry, isOrganizer } from '../lib/helpers/cups';

export default function CupPage({ session }) {
  const { cupId } = useParams();
  const navigate = useNavigate();
  const user = session.user;
  const [cup, setCup] = useState(() => emptyResource());
  const [sports, setSports] = useState(() => emptyResource([]));
  const [groups, setGroups] = useState(() => emptyResource([]));
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision(count => count + 1);

  useEffect(() => startRequest(async signal => {
    try { return await cupService.get(cupId, { signal }); }
    catch (error) {
      // Other users' drafts also return 404, so say so instead of a bare "Cup not found".
      if (error.status === 404) throw new Error('Cup not found. Draft cups are only visible to their organizer.', { cause: error });
      throw error;
    }
  }, setCup), [cupId, revision]);
  useEffect(() => startRequest(signal => sportService.list({ signal }), setSports), []);

  const data = cup.data;
  // Groups are only needed for entering, which is only possible while registration is open.
  const needsGroups = !!user && data?.status === 'registration';
  useEffect(() => needsGroups ? startRequest(signal => groupService.list({ signal }), setGroups) : undefined, [needsGroups]);

  /** Every write sends the revision we last saw; the response is the updated cup. */
  async function mutate(call) {
    try { setCup({ data: await call(data.revision), loading: false, error: null }); }
    catch (error) {
      // 409: someone else changed the cup first. Reload so the user retries against fresh data.
      if (error.status === 409) { reload(); throw new Error(STALE_CUP_MESSAGE, { cause: error }); }
      throw error;
    }
  }

  const update = body => mutate(rev => cupService.update(data.id, { ...body, revision: rev }));
  const review = (groupId, status) => mutate(rev => cupService.updateEntry(data.id, groupId, { status, revision: rev }));
  const enter = groupId => mutate(rev => cupService.createEntry(data.id, { group_id: groupId, revision: rev }));
  const withdraw = groupId => review(groupId, 'withdrawn');
  async function remove() {
    await cupService.remove(data.id);
    navigate('/cups', { replace: true });
  }

  return <main>
    <AsyncState loading={cup.loading && !data} error={data ? null : cup.error} onRetry={reload}>
      {data && <CupContent cup={data} user={user} sports={sports.data || []} groups={groups}
        actions={{ update, review, enter, withdraw, remove }} />}
    </AsyncState>
  </main>;
}

function CupContent({ cup, user, sports, groups, actions }) {
  const organizer = isOrganizer(cup, user);
  const published = cup.status === 'published';
  const sportName = sports.find(sport => sport.id === cup.sport_id)?.name;
  const ownEntries = user ? cup.entries.filter(entry => entry.owner_user_id === user.id && isActiveEntry(entry)) : [];
  const groupOptions = { ...groups, data: user ? eligibleGroups(groups.data || [], cup, user.id) : [] };

  return <>
    <CupHeader cup={cup} sportName={sportName} />
    {organizer && <CupOrganizerActions cup={cup} sports={sports} onUpdate={actions.update} onDelete={actions.remove} />}
    <section className="page-section">
      <h2>Teams</h2>
      {/* Only the organizer reviews entries, and only while registration is open. */}
      <EntryList entries={cup.entries} canReview={organizer && cup.status === 'registration'} onReview={actions.review} />
      {cup.status === 'registration' && cup.format && <EntryRosterControls cup={cup} user={user} groups={groupOptions}
        ownEntries={ownEntries} onEnter={actions.enter} onWithdraw={actions.withdraw} />}
    </section>
    {/* format is null for sports without cups (e.g. walking); there is nothing to draw or rank. */}
    {!cup.format ? <p className="page-section">Cups aren't available for this sport.</p>
      : cup.format === 'knockout' ? <section className="page-section">
        <h2>Bracket</h2>
        <KnockoutBracket fixtures={cup.fixtures} entries={cup.entries} canRecord={organizer && published}
          onRecord={result => actions.update({ result })} />
      </section>
      : <section className="page-section">
        <h2>Results</h2>
        <RaceResultsTable entries={acceptedEntries(cup)} />
        {/* Results can only be recorded after publishing; the server marks the cup completed. */}
        {organizer && published && <RaceResultsForm entries={acceptedEntries(cup)} onRecord={race_results => actions.update({ race_results })} />}
      </section>}
  </>;
}
