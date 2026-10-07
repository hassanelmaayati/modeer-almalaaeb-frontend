import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import AsyncState from '../components/common/AsyncState';
import GroupCard from '../components/groups/GroupCard';
import GroupDialog from '../components/groups/GroupDialog';
import CreateGroupDialog from '../components/groups/CreateGroupDialog';
import RoomPreviewDialog from '../components/activities/RoomPreviewDialog';
import { GroupsArt } from '../components/home/HeroArt';
import { filterGroups, groupRole, loadGroups, loadMoreGroups } from '../lib/helpers/groups';
import useAction from '../lib/helpers/useAction';
import { listen } from '../services/websocketService';

const VIEWS = [{ value: 'joined', label: 'Your groups' }, { value: 'invitations', label: 'Invitations' }];

function GroupsBanner({ children }) {
  return <section className="sports-banner groups-banner" aria-labelledby="groups-title">
    <GroupsArt />
    <div>
      <p className="sports-banner-eyebrow">Teams. Friends. Community.</p>
      <h1 id="groups-title">My groups</h1>
      <p>Keep your communities together and choose which invitations to accept.</p>
    </div>
    {children}
  </section>;
}

export default function GroupsPage({ session }) {
  const { user, loading, error: sessionError } = session;
  const [searchParams, setSearchParams] = useSearchParams();
  const [resource, setResource] = useState(emptyResource);
  const [revision, setRevision] = useState(0);
  const userId = user?.id;
  useEffect(() => userId ? startRequest(loadGroups, setResource) : undefined, [userId, revision]);
  const reload = () => setRevision(value => value + 1);
  const [filters, setFilters] = useState({ view: 'joined', search: '', sportId: '' });
  const [creating, setCreating] = useState(false);
  const groupId = Number(searchParams.get('group_id'));
  const selectedGroupId = Number.isInteger(groupId) && groupId > 0 ? groupId : null;
  const setSelectedGroupId = id => setSearchParams(id ? { group_id: id } : {});
  const [selectedRoom, setSelectedRoom] = useState(null);
  const { groups = [], sports = [], total = null } = resource.data || {};
  const visible = user ? filterGroups(groups, filters) : [];
  const more = useAction();
  const hasMore = total != null ? groups.length < total : groups.length > 0 && groups.length % 20 === 0;
  const loadMore = () => more.run(async () => { const next = await loadMoreGroups(resource.data); setResource(previous => ({ ...previous, data: next })); });
  // Only group events reload the list (not every room or friend event); a membership event counts when it names a group.
  useEffect(() => listen(event => {
    if (event.type === 'connection.ready' || event.type === 'group.updated' || (event.type === 'membership.updated' && event.group_id != null)) setRevision(value => value + 1);
  }), []);

  function openCreated(id) { setCreating(false); setSelectedGroupId(id); }
  function previewRoom(room) { setSelectedGroupId(null); setSelectedRoom(room); }

  if (loading) return <main className="home groups-scope"><div className="home-content"><p role="status">Restoring session…</p></div></main>;
  if (!user) return <main className="home groups-scope"><div className="home-content">
    <GroupsBanner />
    <section className="home-section group-panel">
      <h2>Join the community</h2>
      <p className="home-subtitle">Sign in to see your groups and invitations.</p>
      {sessionError && <p role="alert">{sessionError.message}</p>}
      <Link className="button-primary" to="/sign-in">Sign in</Link>
    </section>
  </div></main>;

  const invitations = filters.view === 'invitations';
  return <main className="home groups-scope">
    <div className="home-content">
      <GroupsBanner>
        <div className="sports-banner-actions">
          <button type="button" className="button-primary" disabled={resource.loading || !resource.data} onClick={() => setCreating(true)}>Create group</button>
        </div>
      </GroupsBanner>
      <section className="home-section" aria-labelledby="groups-list-title">
        <div className="home-section-head">
          <div>
            <h2 id="groups-list-title">{invitations ? 'Invitations' : 'Your groups'}</h2>
            <p className="home-subtitle">{resource.loading || resource.error ? 'Pick a group to see its members and activities.' : `${visible.length} ${invitations ? (visible.length === 1 ? 'invitation' : 'invitations') : (visible.length === 1 ? 'group' : 'groups')} found`}</p>
          </div>
        </div>
        <AsyncState loading={resource.loading} error={resource.error} onRetry={reload}>
          <div className="filters group-filters">
            <div><label htmlFor="group-view">Group view</label><select id="group-view" value={filters.view} onChange={(event) => setFilters({ ...filters, view: event.target.value })}>{VIEWS.map(view => <option key={view.value} value={view.value}>{view.label}</option>)}</select></div>
            <div><label htmlFor="group-search">Search my groups</label><input id="group-search" type="search" placeholder="Name or activity" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></div>
            <div><label htmlFor="group-activity">Activity</label><select id="group-activity" value={filters.sportId} onChange={(event) => setFilters({ ...filters, sportId: event.target.value })}><option value="">All activities</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></div>
          </div>
          <AsyncState isEmpty={!visible.length} emptyTitle={invitations ? 'No invitations found' : 'No groups found'} emptyDescription="Try another filter, or create a group.">
            <div className="card-grid">{visible.map((group) => <GroupCard key={group.id} group={group} invitation={invitations} owned={!invitations && groupRole(group) === 'owner'} onOpen={setSelectedGroupId} />)}</div>
          </AsyncState>
          {more.error && <p role="alert" className="error-message">{more.error}</p>}
          {hasMore && <div className="actions"><button type="button" className="button-secondary" disabled={more.pending} onClick={loadMore}>{more.pending ? 'Loading…' : 'Load more groups'}</button></div>}
        </AsyncState>
      </section>
    </div>
    {creating && <CreateGroupDialog sports={sports} userId={user.id} onClose={() => setCreating(false)} onCreated={reload} onOpenGroup={openCreated} />}
    {selectedGroupId && <GroupDialog key={selectedGroupId} user={user} groupId={selectedGroupId} sports={sports} onClose={() => setSelectedGroupId(null)} onChanged={reload} onPreviewRoom={previewRoom} />}
    {selectedRoom && <RoomPreviewDialog session={session} room={selectedRoom} sportName={sports.find((sport) => sport.id === selectedRoom.sport_id)?.name} onClose={() => setSelectedRoom(null)} onUpdated={reload} />}
  </main>;
}
