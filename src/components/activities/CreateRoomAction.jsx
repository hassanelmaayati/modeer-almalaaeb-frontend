import { Link } from "react-router";

export default function CreateRoomAction({ session, className }) {
    if (session.loading) return null;

    return session.user
        ? <Link className={className} to="/rooms/new">Host a Room</Link>
        : <Link className={className} to="/sign-in" state={{ from: '/rooms/new' }}>Sign in to host a room</Link>
}