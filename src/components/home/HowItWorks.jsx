const STEPS = [
  { title: 'Find a game', text: 'Browse upcoming games in your area' },
  { title: 'Join the room', text: "Request to join or instantly join depending on the host's settings" },
  { title: 'Meet and play', text: 'Connect with players, show up, and enjoy the game' },
];

export default function HowItWorks() {
  return <section className="home-section" aria-labelledby="home-how-title">
    <h2 id="home-how-title">How it works</h2>
    <p className="home-subtitle">Three simple steps to get on the pitch</p>
    <ol className="how-steps">
      {STEPS.map((step, index) => <li key={step.title}>
        <span className="how-number" aria-hidden="true">{index + 1}</span>
        <div><h3>{step.title}</h3><p>{step.text}</p></div>
      </li>)}
    </ol>
  </section>;
}
