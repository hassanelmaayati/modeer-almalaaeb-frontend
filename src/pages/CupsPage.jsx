import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import cupService from '../services/cupService';
import sportService from '../services/sportService';
import AsyncState from '../components/common/AsyncState';
import useAction from '../lib/helpers/useAction';
import CupCardList from '../components/cups/CupCardList';
import CupStatusFilters from '../components/cups/CupStatusFilters';
import CreateCupAction from '../components/cups/CreateCupAction';
import { BracketArt } from '../components/home/HeroArt';

// GET /cups is paged (backend default 50, max 100); a full page means there may be more.
const CUPS_PAGE = 50;
const toPage = items => ({ items, hasMore: items.length === CUPS_PAGE });

export default function CupsPage({ session }) {
  // Status lives in the URL so a filtered list can be shared or reloaded.
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const [cups, setCups] = useState(() => emptyResource({ items: [], hasMore: false }));
  const [sports, setSports] = useState(() => emptyResource([]));
  const [retry, setRetry] = useState(0);
  useEffect(() => startRequest(signal => sportService.list({ signal }), setSports), []);
  const more = useAction();
  useEffect(() => startRequest(signal => cupService.list({ status, limit: CUPS_PAGE, offset: 0 }, { signal }).then(toPage), setCups), [status, retry]);
  const loadMore = () => more.run(async () => {
    const next = toPage(await cupService.list({ status, limit: CUPS_PAGE, offset: cups.data.items.length }));
    setCups(previous => ({ ...previous, data: { items: [...previous.data.items, ...next.items], hasMore: next.hasMore } }));
  });

  const changeStatus = value => setSearchParams(value ? { status: value } : {});
  const items = cups.data?.items || [];
  const count = items.length;

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
            <p className="home-subtitle">{cups.loading || cups.error ? 'Teams. Fixtures. Across Bahrain.' : `${count}${cups.data?.hasMore ? '+' : ''} ${count === 1 ? 'cup' : 'cups'} found`}</p>
          </div>
        </div>
        <CupStatusFilters value={status} onChange={changeStatus} signedIn={!!session.user} />
        <AsyncState loading={cups.loading} error={cups.error} onRetry={() => setRetry(value => value + 1)}
          isEmpty={!count} emptyTitle="No cups yet" emptyDescription="Create one or check back later.">
          <CupCardList cups={items} sports={sports.data || []} />
          {more.error && <p role="alert">{more.error}</p>}
          {cups.data?.hasMore && <div className="actions"><button type="button" className="button-secondary" disabled={more.pending} onClick={loadMore}>{more.pending ? 'Loading…' : 'Load more'}</button></div>}
        </AsyncState>
      </section>
    </div>
  </main>;
}
