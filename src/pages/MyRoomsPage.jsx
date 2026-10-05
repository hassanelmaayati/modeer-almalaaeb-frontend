// The rooms the signed-in user hosts. The route is guarded by RequireAuth, so a user always exists here.
// The list, history filters and paging are added in the next steps.
export default function MyRoomsPage() {
  return <main>
    <h1>My rooms</h1>
    <p className="muted">Rooms you host will appear here.</p>
  </main>;
}
