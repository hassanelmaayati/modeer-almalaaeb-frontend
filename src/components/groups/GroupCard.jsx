import Icon from '../common/Icon';
import SportIcon from '../common/SportIcon';

export default function GroupCard({ group, onOpen, invitation = false, owned = false }) {
  const count = Number.isInteger(group.member_count) ? group.member_count : null;
  return <article className={`group-card${invitation ? ' group-card-invitation' : ''}`}>
    <header className="group-card-top">
      <span className="group-card-sport"><SportIcon name={group.sportName} size={30} /></span>
      <span className="group-card-kicker">{group.sportName}</span>
      {invitation && <span className="status-badge group-badge-invite">Invitation</span>}
      {owned && <span className="status-badge group-badge-owner">Owner</span>}
    </header>
    <h3>{group.name}</h3>
    {group.photo_url && <img className="group-cover" src={group.photo_url} alt="" loading="lazy" />}
    {group.description && <p className="group-card-description">{group.description}</p>}
    <footer className="group-card-foot">
      {count !== null && <span className="group-card-members"><Icon name="people" />{count} {count === 1 ? 'member' : 'members'}</span>}
      <button type="button" className="group-card-cta" onClick={() => onOpen(group.id)}>Open group <Icon name="arrow" size={16} /></button>
    </footer>
  </article>;
}
