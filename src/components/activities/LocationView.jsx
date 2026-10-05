import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { OSM_TILES } from '../../lib/helpers/leaflet';

/** Read-only map for a room's private venue pin. Only render it when the backend sent `venue_location`. */
export default function LocationView({ location }) {
  const position = [location.latitude, location.longitude];
  return <div className="location-view">
    <MapContainer center={position} zoom={16} style={{ height: '240px', width: '100%' }} scrollWheelZoom={false}>
      <TileLayer attribution={OSM_TILES.attribution} url={OSM_TILES.url} />
      <Marker position={position} />
    </MapContainer>
    <p><a href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=17/${location.latitude}/${location.longitude}`} target="_blank" rel="noreferrer">Open in OpenStreetMap</a></p>
  </div>;
}
