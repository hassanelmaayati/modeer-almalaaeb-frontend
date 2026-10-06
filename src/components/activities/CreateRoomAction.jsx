import { Link } from "react-router";

export default function CreateRoomAction({ session, className, label = 'Host a Room', signedOutLabel = 'Sign in to host a room' }) {
    if (session.loading) return null;

    return session.user
        ? <Link className={className} to="/rooms/new">{label}</Link>
        : <Link className={className} to="/sign-in">{signedOutLabel}</Link>
}
