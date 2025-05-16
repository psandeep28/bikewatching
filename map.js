// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);

// map.js

// Set your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoicHNhbmRlZXAiLCJhIjoiY21hcWIzNzFkMDgwYTJqcTZ5a29ramhmcyJ9.3xuzDkrrcQjg-Q7F80JwFQ';

// Create the map instance
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // or your custom style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});
