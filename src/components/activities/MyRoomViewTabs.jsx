import { Link } from 'react-router';
import { MY_ROOM_VIEWS, myRoomFiltersToSearchParams, resolveMyRoomFilters, withMyRoomView } from '../../lib/helpers/filters';

export default function MyRoomViewTabs({ filters }) {
  const current = resolveMyRoomFilters(filters).view;
  return <nav aria-label="Room views" className="button-row">
    {MY_ROOM_VIEWS.map(({ value, label }) => {
      const search = myRoomFiltersToSearchParams(withMyRoomView(filters, value)).toString();
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
