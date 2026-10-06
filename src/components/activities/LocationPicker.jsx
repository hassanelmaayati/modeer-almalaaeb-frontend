import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { BAHRAIN_BOUNDS, BAHRAIN_CENTER, OSM_TILES } from '../../lib/helpers/leaflet';

const insideBahrain = ({ lat, lng }) =>
  lat >= BAHRAIN_BOUNDS[0][0] && lat <= BAHRAIN_BOUNDS[1][0] && lng >= BAHRAIN_BOUNDS[0][1] && lng <= BAHRAIN_BOUNDS[1][1];

function ClickToPin({ onPick }) {
  useMapEvents({ click: event => { if (insideBahrain(event.latlng)) onPick(event.latlng); } });
  return null;
}

/**
 * Click the map to drop or move the pin. `value` is { latitude, longitude } or null; `onChange` gets the same shape
 * (or null when cleared). Set canClear={false} when a caller requires an existing pin to remain set.
 */
export default function LocationPicker({ value, onChange, canClear = true, disabled = false }) {
  const position = value ? [value.latitude, value.longitude] : null;
  return <div className="location-picker">
    <MapContainer
      center={position || BAHRAIN_CENTER}
      zoom={position ? 15 : 10}
      minZoom={9}
      maxBounds={BAHRAIN_BOUNDS}
      maxBoundsViscosity={1}
      style={{ height: '320px', width: '100%' }}
    >
      <TileLayer attribution={OSM_TILES.attribution} url={OSM_TILES.url} />
      {!disabled && <ClickToPin onPick={({ lat, lng }) => onChange({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) })} />}
      {position && <Marker position={position} />}
    </MapContainer>
    <p className="muted">
      {disabled
        ? (position ? `Pin at ${value.latitude}, ${value.longitude}.` : 'No pin set.')
        : (position ? `Pin at ${value.latitude}, ${value.longitude}. Click the map to move it.${canClear ? '' : ' A saved pin can be moved but not removed.'}` : 'Click the map to drop a pin on the exact venue (optional).')}
    </p>
    {position && canClear && !disabled && <button type="button" onClick={() => onChange(null)}>Clear pin</button>}
  </div>;
}
