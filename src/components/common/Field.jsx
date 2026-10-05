export default function Field({ label, children, error }) {
  return <label className="form-field">{label}{children}{error && <span role="alert" className="field-error">{error}</span>}</label>;
}
