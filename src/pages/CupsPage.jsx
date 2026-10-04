import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import cupService from '../services/cupService';
import sportService from '../services/sportService';
import AsyncState from '../components/common/AsyncState';
import CupCardList from '../components/cups/CupCardList';
import CupStatusFilters from '../components/cups/CupStatusFilters';
import CreateCupAction from '../components/cups/CreateCupAction';

export default function CupsPage({ session }) {
  // Status lives in the URL so a filtered list can be shared or reloaded.
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const [cups, setCups] = useState(() => emptyResource([]));
  const [sports, setSports] = useState(() => emptyResource([]));
  const [retry, setRetry] = useState(0);
  useEffect(() => startRequest(signal => sportService.list({ signal }), setSports), []);
  useEffect(() => startRequest(signal => cupService.list({ status }, { signal }), setCups), [status, retry]);

  const changeStatus = value => setSearchParams(value ? { status: value } : {});

  return <main>
    <div className="section-heading">
      <h1>Cups</h1>
      <CreateCupAction session={session} />
    </div>
    <CupStatusFilters value={status} onChange={changeStatus} />
    <AsyncState loading={cups.loading} error={cups.error} onRetry={() => setRetry(count => count + 1)}
      isEmpty={!cups.data?.length} emptyTitle="No cups yet" emptyDescription="Create one or check back later.">
      <CupCardList cups={cups.data || []} sports={sports.data || []} />
    </AsyncState>
  </main>;
}
