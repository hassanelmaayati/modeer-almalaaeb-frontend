import CupCard from './CupCard';

export default function CupCardList({ cups, sports = [] }) {
  return <div className="card-grid">
    {cups.map(cup => <CupCard key={cup.id} cup={cup} sportName={sports.find(sport => sport.id === cup.sport_id)?.name} />)}
  </div>;
}
