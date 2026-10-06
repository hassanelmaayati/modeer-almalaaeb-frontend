import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import cupService from '../services/cupService';
import sportService from '../services/sportService';
import AsyncState from '../components/common/AsyncState';
import CupForm from '../components/cups/CupForm';
import { BracketArt } from '../components/home/HeroArt';

// Guarded by RequireAuth only: any signed-in user may organize a cup (no global role).
export default function CreateCupPage() {
  const navigate = useNavigate();
  const [sports, setSports] = useState(() => emptyResource([]));
  const [retry, setRetry] = useState(0);
  useEffect(() => startRequest(signal => sportService.list({ signal }), setSports), [retry]);

  async function create(body) {
    await cupService.create(body);
    // The cup list includes the organizer's own drafts, so the new cup shows up there.
    navigate('/cups');
  }

  return <main className="home cups-scope">
    <div className="home-content">
      <section className="sports-banner cups-banner" aria-labelledby="create-cup-title">
        <BracketArt />
        <div className="cups-banner-title">
          <div>
            <p className="sports-banner-eyebrow">Be the organizer</p>
            <h1 id="create-cup-title">Create a cup</h1>
            <p>Pick a sport, set the rules and open the draw to teams.</p>
          </div>
        </div>
      </section>
      <section className="home-section cup-panel">
        <AsyncState loading={sports.loading} error={sports.error} onRetry={() => setRetry(count => count + 1)}>
          <CupForm sports={sports.data || []} onSubmit={create} onCancel={() => navigate('/cups')} />
        </AsyncState>
      </section>
    </div>
  </main>;
}
