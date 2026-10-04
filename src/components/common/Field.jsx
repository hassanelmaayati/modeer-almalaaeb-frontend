export default function Field({ label, children }) {
  return <label className="form-field">{label}{children}</label>;
}
