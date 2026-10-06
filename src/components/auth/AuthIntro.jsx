import { LogoMark } from '../common/Logo';

export default function AuthIntro({ title, text }) {
  return <section className="auth-intro">
    <LogoMark size={56} />
    <h2>{title}</h2>
    {text && <p>{text}</p>}
  </section>;
}
