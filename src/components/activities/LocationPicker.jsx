import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// Same box the backend uses to reject pins in the sea or abroad.
const BAHRAIN_BOUNDS = [[25.5, 50.3], [26.4, 50.9]];
const BAHRAIN_CENTER = [26.05, 50.55];

const insideBahrain = ({ lat, lng }) =>
  lat >= BAHRAIN_BOUNDS[0][0] && lat <= BAHRAIN_BOUNDS[1][0] && lng >= BAHRAIN_BOUNDS[0][1] && lng <= BAHRAIN_BOUNDS[1][1];

function ClickToPin({ onPick }) {
  useMapEvents({ click: event => { if (insideBahrain(event.latlng)) onPick(event.latlng); } });
  return null;
}

/**
 * Click the map to drop or move the pin. `value` is { latitude, longitude } or null; `onChange` gets the same shape
 * (or null when cleared). Pass canClear={false} when the backend cannot remove a saved pin (editing a room).
 */
export default function LocationPicker({ value, onChange, canClear = true }) {
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
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToPin onPick={({ lat, lng }) => onChange({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) })} />
      {position && <Marker position={position} />}
    </MapContainer>
    <p className="muted">
      {position ? `Pin at ${value.latitude}, ${value.longitude}. Click the map to move it.` : 'Click the map to drop a pin on the exact venue (optional).'}
    </p>
    {position && canClear && <button type="button" onClick={() => onChange(null)}>Clear pin</button>}
  </div>;
}
