export default function AuthIntro({ title, text }) {
  return <section className="auth-intro">
    <h2>{title}</h2>
    {text && <p>{text}</p>}
  </section>;
}
