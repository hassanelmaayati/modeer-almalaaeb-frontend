import { Link } from 'react-router';

export default function RoomViewTabs({ filterSet, filters }) {
  const current = filterSet.resolve(filters).view;
  return <nav aria-label="Room views" className="button-row">
    {filterSet.views.map(({ value, label }) => {
      const search = filterSet.toSearchParams(filterSet.withView(filters, value)).toString();
      const active = value === current;
      return <Link
        key={value}
        to={{ search: search ? `?${search}` : '' }}
        className={active ? 'button' : 'button-secondary'}
        aria-current={active ? 'page' : undefined}
      >{label}</Link>;
    })}
  </nav>;
}
