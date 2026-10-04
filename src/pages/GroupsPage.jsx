import { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import AsyncState from '../components/common/AsyncState';
import GroupCard from '../components/groups/GroupCard';
import GroupDialog from '../components/groups/GroupDialog';
import CreateGroupDialog from '../components/groups/CreateGroupDialog';
import RoomPreviewDialog from '../components/activities/RoomPreviewDialog';
import { filterGroups, loadGroups } from '../lib/helpers/groups';
import { listen } from '../services/websocketService';
import { roomEvent } from '../lib/helpers/live';

export default function GroupsPage({ session }) {
  const { user, loading, error: sessionError } = session;
  const location = useLocation();
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
  const { groups = [], sports = [], users = [] } = resource.data || {};
  const visible = user ? filterGroups(groups, user.id, filters) : [];
  const failedMemberships = groups.some((group) => group.membershipError);
  useEffect(() => listen(event => {
    if (event.type === 'connection.ready' || ['group.updated', 'membership.updated', 'friend.updated'].includes(event.type) || roomEvent(event)) setRevision(value => value + 1);
  }), []);

  function openCreated(id) { setCreating(false); setSelectedGroupId(id); }
  function previewRoom(room) { setSelectedGroupId(null); setSelectedRoom(room); }

  if (loading) return <main><p role="status">Restoring session…</p></main>;
  if (!user) return <main><h1>My groups</h1><p>Sign in to see your groups and invitations.</p>{sessionError && <p role="alert">{sessionError.message}</p>}<Link to="/sign-in" state={{ from: location.pathname + location.search }}>Sign in</Link></main>;

  return <main>
    <header className="page-header"><h1>My groups</h1><p>Keep your communities together and choose which invitations to accept.</p>
      <button type="button" disabled={resource.loading || !resource.data} onClick={() => setCreating(true)}>Create group</button>
    </header>
    <AsyncState loading={resource.loading} error={resource.error} onRetry={reload}>
      <div className="filters">
        <div><label htmlFor="group-view">Group view</label><select id="group-view" value={filters.view} onChange={(event) => setFilters({ ...filters, view: event.target.value })}><option value="joined">Your groups</option><option value="invitations">Invitations</option></select></div>
        <div><label htmlFor="group-search">Search my groups</label><input id="group-search" type="search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></div>
        <div><label htmlFor="group-activity">Activity</label><select id="group-activity" value={filters.sportId} onChange={(event) => setFilters({ ...filters, sportId: event.target.value })}><option value="">All activities</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></div>
      </div>
      {failedMemberships && <div role="alert"><p>Some memberships could not be loaded. Your groups or invitations may be incomplete.</p><button type="button" onClick={reload}>Try again</button></div>}
      <AsyncState isEmpty={!visible.length} emptyTitle={filters.view === 'invitations' ? 'No invitations found' : 'No groups found'} emptyDescription="Try another filter, or create a group.">
        <div className="card-grid">{visible.map((group) => <GroupCard key={group.id} group={group} onOpen={setSelectedGroupId} />)}</div>
      </AsyncState>
    </AsyncState>
    {creating && <CreateGroupDialog sports={sports} users={users} userId={user.id} onClose={() => setCreating(false)} onCreated={reload} onOpenGroup={openCreated} />}
    {selectedGroupId && <GroupDialog key={selectedGroupId} user={user} groupId={selectedGroupId} sports={sports} users={users} onClose={() => setSelectedGroupId(null)} onChanged={reload} onPreviewRoom={previewRoom} />}
    {selectedRoom && <RoomPreviewDialog session={session} room={selectedRoom} sportName={sports.find((sport) => sport.id === selectedRoom.sport_id)?.name} onClose={() => setSelectedRoom(null)} onUpdated={reload} />}
  </main>;
}
