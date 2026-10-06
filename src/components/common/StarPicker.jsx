import { starsLabel } from '../../lib/helpers/ratings';

/**
 * 1-5 star picker built from native radio inputs: arrow keys move between stars, Tab enters and leaves the group,
 * and each star has a text label. Filled (★) versus outlined (☆) shapes carry the value, not colour alone.
 * Pass `disabled` for a locked, read-only display of `value`.
 */
export default function StarPicker({ name, label, value = 0, onChange, disabled = false, max = 5 }) {
  return <fieldset className="star-picker" disabled={disabled}>
    <legend>{label}</legend>
    {Array.from({ length: max }, (_, index) => index + 1).map(star => <label key={star} className={`star-option${star <= value ? ' is-on' : ''}`}>
      {/* The radio stays in the accessibility tree (visually hidden), so focus and checked state are announced. */}
      {/* Disabled on the input too, not just the fieldset, so a locked star can never fire a change. */}
      <input className="visually-hidden" type="radio" name={name} value={star} checked={value === star} disabled={disabled} onChange={() => onChange?.(star)} />
      <span aria-hidden="true">{star <= value ? '★' : '☆'}</span>
      <span className="visually-hidden">{starsLabel(star)}</span>
    </label>)}
  </fieldset>;
}
