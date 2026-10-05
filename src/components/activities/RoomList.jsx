import AsyncState from '../common/AsyncState';
import RoomCard from './RoomCard';

export default function RoomList({ rooms = [], sports = [], loading, error, onRetry, onPreview, Card = RoomCard, emptyTitle = 'No upcoming activities', emptyDescription = 'Try another activity, district or date.' }) {
  return (
    <AsyncState loading={loading} error={error} onRetry={onRetry} isEmpty={rooms.length === 0} emptyTitle={emptyTitle} emptyDescription={emptyDescription}>
      <div className="card-grid room-grid">
        {rooms.map((room) => <Card key={room.id} room={room} sportName={sports.find((sport) => sport.id === room.sport_id)?.name} onPreview={onPreview} />)}
      </div>
    </AsyncState>
  );
}
