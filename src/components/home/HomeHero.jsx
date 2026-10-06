import { Link } from 'react-router';
import CreateRoomAction from '../activities/CreateRoomAction';
import { CourtArt, PitchArt } from './HeroArt';

export default function HomeHero({ session }) {
  return <section className="home-hero" aria-labelledby="home-hero-title">
    <PitchArt />
    <div className="home-hero-copy">
      <h1 id="home-hero-title">Your next game starts here</h1>
      <p>Find players. Join games. Play across Bahrain.</p>
      <div className="home-hero-actions">
        <Link className="button-primary" to="/sports">Find a game</Link>
        <CreateRoomAction session={session} className="button-outline" label="Host a room" signedOutLabel="Sign in to host a room" />
      </div>
    </div>
    <p className="home-hero-tag" aria-hidden="true"><span>Same</span><span>people</span><span>brighter</span><span>games</span></p>
    <CourtArt />
  </section>;
}
