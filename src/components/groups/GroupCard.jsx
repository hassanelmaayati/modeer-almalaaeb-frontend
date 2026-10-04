import { acceptedMemberCount } from '../../lib/helpers/memberships';

export default function GroupCard({ group, onOpen }) {
  return <article className="group-card">
    <h3>{group.name}</h3>
    <p>{group.sportName}{group.members && ` · ${acceptedMemberCount(group.members)} accepted members`}</p>
    {group.photo_url && <img className="group-cover" src={group.photo_url} alt="" loading="lazy" />}
    {group.description && <p>{group.description}</p>}
    {group.membershipError && <p>Membership details are unavailable.</p>}
    <button type="button" onClick={() => onOpen(group.id)}>Open group</button>
  </article>;
}
