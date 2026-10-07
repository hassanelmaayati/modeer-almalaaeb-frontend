import { Link } from 'react-router';
import { OutOfBoundsArt } from '../components/home/HeroArt';

export default function NotFoundPage() {
  return <main className="home status-scope">
    <div className="home-content">
      <section className="sports-banner not-found-banner" aria-labelledby="not-found-title">
        <OutOfBoundsArt />
        <div>
          <p className="sports-banner-eyebrow">Out of bounds</p>
          <h1 id="not-found-title">Page not found</h1>
          <p>Use the navigation to return to a working page.</p>
        </div>
        <div className="sports-banner-actions">
          <Link className="button-primary" to="/">Back to home</Link>
          <Link className="button-outline" to="/sports">Find games</Link>
        </div>
      </section>
    </div>
  </main>;
}
