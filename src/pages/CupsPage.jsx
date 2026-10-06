import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import cupService from '../services/cupService';
import sportService from '../services/sportService';
import AsyncState from '../components/common/AsyncState';
import CupCardList from '../components/cups/CupCardList';
import CupStatusFilters from '../components/cups/CupStatusFilters';
import CreateCupAction from '../components/cups/CreateCupAction';
import { BracketArt } from '../components/home/HeroArt';

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
  const count = cups.data?.length || 0;

  return <main className="home cups-scope">
    <div className="home-content">
      <section className="sports-banner cups-banner" aria-labelledby="cups-title">
        <BracketArt />
        <div className="cups-banner-title">
          <div>
            <p className="sports-banner-eyebrow">Brackets. Rivals. Glory.</p>
            <h1 id="cups-title">Cups</h1>
            <p>Enter a team, climb the bracket and lift the trophy</p>
          </div>
        </div>
        <div className="sports-banner-actions">
          <CreateCupAction session={session} className="button-primary" />
        </div>
      </section>
      <section className="home-section cups-list" aria-labelledby="cups-list-title">
        <div className="home-section-head">
          <div>
            <h2 id="cups-list-title">Browse cups</h2>
            <p className="home-subtitle">{cups.loading || cups.error ? 'Teams. Fixtures. Across Bahrain.' : `${count} ${count === 1 ? 'cup' : 'cups'} found`}</p>
          </div>
        </div>
        <CupStatusFilters value={status} onChange={changeStatus} />
        <AsyncState loading={cups.loading} error={cups.error} onRetry={() => setRetry(value => value + 1)}
          isEmpty={!cups.data?.length} emptyTitle="No cups yet" emptyDescription="Create one or check back later.">
          <CupCardList cups={cups.data || []} sports={sports.data || []} />
        </AsyncState>
      </section>
    </div>
  </main>;
}
