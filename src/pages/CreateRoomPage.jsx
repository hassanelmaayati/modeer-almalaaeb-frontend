import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import roomService from '../services/roomService';
import sportService from '../services/sportService';
import groupService from '../services/groupService';
import AsyncState from '../components/common/AsyncState';
import RoomForm from '../components/activities/RoomForm';
import { HostArt } from '../components/home/HeroArt';

// Guarded by RequireAuth only: any signed-in user may host a room.
export default function CreateRoomPage({ session }) {
    const navigate = useNavigate();
    const userId = session.user?.id;
    const [options, setOptions] = useState(() => emptyResource({ sports: [], groups: [] }));
    const [retry, setRetry] = useState(0);

    // Sports and groups are loaded together so the form renders once with both lists
    useEffect(() => startRequest(async signal => {
        const [sports, groups] = await Promise.all([
            sportService.list({ signal }),
            groupService.mine({ signal }),
        ]);

        // The backend only lets you create a group room for a group you own
        return { sports, groups: groups.filter(group => group.owner_id === userId) };
    }, setOptions), [userId, retry]);

    async function create(body) {
        const room = await roomService.create(body);

        // The new room's page shows the host the private venue details straight away
        navigate(`/rooms/${room.id}`);
    }

    return <main className="home host-scope">
        <div className="home-content">
            <section className="sports-banner host-banner" aria-labelledby="host-title">
                <HostArt />
                <div>
                    <p className="sports-banner-eyebrow">Call the players. Set the game.</p>
                    <h1 id="host-title">Host a room</h1>
                    <p>Build your game card, share the details and let players join.</p>
                </div>
            </section>
            <AsyncState loading={options.loading} error={options.error} onRetry={() => setRetry(count => count + 1)}>
                <RoomForm
                    sports={options.data?.sports || []}
                    groups={options.data?.groups || []}
                    onSubmit={create}
                    onCancel={() => navigate(-1)}
                />
            </AsyncState>
        </div>
    </main>
}