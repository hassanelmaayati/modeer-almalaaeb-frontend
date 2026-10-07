import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// The map marker is a red pin drawn as an SVG, so it stays sharp on any screen and needs no image files that Vite would not copy.
const RED_PIN = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">'
  + '<path d="M15 1C7.3 1 1 7.2 1 14.8 1 25 15 41 15 41S29 25 29 14.8C29 7.2 22.7 1 15 1Z" fill="#d62f2f" stroke="#a31c1c" stroke-width="1.5" stroke-linejoin="round"/>'
  + '<circle cx="15" cy="14.5" r="5.5" fill="#fff"/></svg>',
)}`;

// Leaflet's default icon lookup glues a detected folder path in front of whatever URL it is given, which breaks any bundled or
// inline image (the marker then shows as the alt text "Marker"), so drop that lookup before setting our own icon.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: RED_PIN, iconRetinaUrl: RED_PIN, shadowUrl: null,
  iconSize: [30, 42], iconAnchor: [15, 41], popupAnchor: [0, -38],
});

// Same box the backend uses to reject pins in the sea or abroad.
export const BAHRAIN_BOUNDS = [[25.5, 50.3], [26.4, 50.9]];
export const BAHRAIN_CENTER = [26.05, 50.55];
export const OSM_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
