import { useState } from 'react';

const RADIUS_OPTIONS = [2, 5, 10, 20, 50];
// Two decimals is about 1 km: enough to rank rooms by distance without sending an exact position.
const roundCoordinate = value => Math.round(value * 100) / 100;

const FAILURES = {
  1: 'Location permission was denied. You can keep browsing without it.',
  2: 'Your location is not available right now.',
  3: 'Finding your location took too long. Please try again.',
};

/** Optional "Near me": asks the browser for a location only when pressed, and keeps it in memory (never saved or shown). */
export default function NearMeFilter({ near, radius, onNear, onRadius }) {
  const [state, setState] = useState({ asking: false, error: '' });
  if (!('geolocation' in navigator)) return null;

  function askForLocation() {
    setState({ asking: true, error: '' });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setState({ asking: false, error: '' }); onNear({ lat: roundCoordinate(coords.latitude), lng: roundCoordinate(coords.longitude) }); },
      failure => setState({ asking: false, error: FAILURES[failure.code] || FAILURES[2] }),
      { maximumAge: 5 * 60_000, timeout: 10_000 },
    );
  }

  return <section className="near-me panel" aria-label="Near me">
    {near
      ? <div className="button-row">
        <label className="form-field">Show activities within
          <select value={radius} onChange={event => onRadius(Number(event.target.value))}>
            {RADIUS_OPTIONS.map(km => <option key={km} value={km}>{km} km</option>)}
          </select>
        </label>
        <button type="button" className="button-secondary" onClick={() => onNear(null)}>Stop using my location</button>
      </div>
      : <div className="button-row">
        <button type="button" className="button-secondary" disabled={state.asking} onClick={askForLocation}>{state.asking ? 'Finding your location…' : 'Near me'}</button>
        <span className="muted">Optional. Your browser will ask first, and your location is not stored.</span>
      </div>}
    {state.error && <p role="alert" className="error-message">{state.error}</p>}
  </section>;
}
