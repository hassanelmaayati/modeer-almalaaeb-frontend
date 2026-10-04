import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import cupService from '../services/cupService';
import sportService from '../services/sportService';
import AsyncState from '../components/common/AsyncState';
import CupForm from '../components/cups/CupForm';

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

  return <main>
    <h1>Create a cup</h1>
    <AsyncState loading={sports.loading} error={sports.error} onRetry={() => setRetry(count => count + 1)}>
      <CupForm sports={sports.data || []} onSubmit={create} onCancel={() => navigate('/cups')} />
    </AsyncState>
  </main>;
}
