import FixtureResultControls from './FixtureResultControls';
import { TrophyArt } from '../home/HeroArt';

function roundName(round, lastRound) {
  if (round === lastRound) return 'Final';
  if (round === lastRound - 1) return 'Semi-finals';
  if (round === lastRound - 2) return 'Quarter-finals';
  return `Round ${round}`;
}

export default function KnockoutBracket({ fixtures, entries, canRecord, onRecord }) {
  // The server draws the bracket on publish; until then there are no fixtures.
  if (!fixtures.length) return <p className="muted">The bracket is drawn when the cup is published.</p>;
  const names = new Map(entries.map(entry => [entry.group_id, entry.group_name]));
  // A null side means that slot waits for an earlier round's winner.
  const name = groupId => groupId == null ? 'TBD' : names.get(groupId) || `Team ${groupId}`;
  const rounds = [...new Set(fixtures.map(fixture => fixture.round))].sort((a, b) => a - b);
  const lastRound = rounds.at(-1);
  const final = fixtures.find(fixture => fixture.round === lastRound);
  const champion = final?.winner_group_id != null ? name(final.winner_group_id) : null;

  return <div className="bracket">
    {rounds.map(round => <section key={round} className="bracket-round">
      <h3>{roundName(round, lastRound)}</h3>
      {fixtures.filter(fixture => fixture.round === round).sort((a, b) => a.match - b.match).map(fixture => {
        const played = fixture.home_score != null && fixture.away_score != null;
        const ready = fixture.home_group_id != null && fixture.away_group_id != null;
        return <article key={fixture.id} className="fixture">
          {[['home', fixture.home_group_id, fixture.home_score], ['away', fixture.away_group_id, fixture.away_score]].map(([side, groupId, score]) =>
            <p key={side} className={played && fixture.winner_group_id === groupId ? 'fixture-winner' : undefined}>
              <span>{name(groupId)}</span>{played && <strong>{score}</strong>}
            </p>)}
          {/* Recorded results are final in this UI; only unplayed fixtures with both teams get controls. */}
          {!played && ready && canRecord && <FixtureResultControls fixture={fixture} homeName={name(fixture.home_group_id)} awayName={name(fixture.away_group_id)} onRecord={onRecord} />}
        </article>;
      })}
    </section>)}
    <section className="bracket-round bracket-champion">
      <h3>Champion</h3>
      <div className={`champion-card${champion ? ' has-champion' : ''}`}>
        <TrophyArt size={64} />
        <strong>{champion || 'To be decided'}</strong>
      </div>
    </section>
  </div>;
}
