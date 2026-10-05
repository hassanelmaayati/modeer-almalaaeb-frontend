import { Link } from 'react-router';
import { DEFAULT_FRIEND_TAB, FRIEND_TABS } from '../../lib/helpers/friends';

export default function FriendTabs({ current, groups }) {
  return <nav aria-label="Friend lists" className="button-row">
    {FRIEND_TABS.map(({ value, label, group }) => {
      const active = value === current;
      return <Link
        key={value}
        to={{ search: value === DEFAULT_FRIEND_TAB ? '' : `?tab=${value}` }}
        className={active ? 'button' : 'button-secondary'}
        aria-current={active ? 'page' : undefined}
      >{label} ({groups[group].length})</Link>;
    })}
  </nav>;
}
