// Import Mapbox and D3 as ES Modules
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Set your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoicHNhbmRlZXAiLCJhIjoiY21hcWIzNzFkMDgwYTJqcTZ5a29ramhmcyJ9.3xuzDkrrcQjg-Q7F80JwFQ';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// Helper function to project coordinates to screen space
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

map.on('load', async () => {
  // --- Add Boston bike lanes ---
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addLayer({
    id: 'bike-lanes-boston',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 4,
      'line-opacity': 0.6,
    },
  });

  // --- Add Cambridge bike lanes ---
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });

  map.addLayer({
    id: 'bike-lanes-cambridge',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 4,
      'line-opacity': 0.6,
    },
  });

  // --- Select SVG overlay ---
  const svg = d3.select('#map').select('svg');

  // --- Load station metadata ---
  let stations = [];
  try {
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    const jsonData = await d3.json(jsonurl);
    stations = jsonData.data.stations;
  } catch (error) {
    console.error('Error loading Bluebikes station data:', error);
    return;
  }

  console.log('Max total traffic:', d3.max(stations, d => d.totalTraffic));
console.log(stations.slice(0, 5)); // Optional: print first 5 stations for manual inspection


  // --- Load traffic data ---
  let trips = [];
  try {
    trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv');
  } catch (error) {
    console.error('Error loading Bluebikes traffic data:', error);
    return;
  }

  // --- Aggregate arrivals and departures ---
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );



  stations = stations.map((station) => {
    const id = station.short_name; // ✅ Correct field
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });
  

  // --- Create square root scale for circle radius ---
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

// Get the tooltip div
const tooltip = d3.select('#tooltip');

const circles = svg
  .selectAll('circle')
  .data(stations)
  .enter()
  .append('circle')
  .attr('r', (d) => radiusScale(d.totalTraffic))
  .attr('fill', 'steelblue')
  .attr('stroke', 'white')
  .attr('stroke-width', 1.5)
  .attr('opacity', 0.8)
  .on('mouseover', function (event, d) {
    tooltip
      .style('display', 'block')
      .html(
        `<strong>${d.totalTraffic} trips</strong><br>${d.departures} departures<br>${d.arrivals} arrivals`
      );
    d3.select(this).attr('stroke', 'yellow');
  })
  .on('mousemove', function (event) {
    tooltip
      .style('left', event.pageX + 12 + 'px')
      .style('top', event.pageY - 28 + 'px');
  })
  .on('mouseout', function () {
    tooltip.style('display', 'none');
    d3.select(this).attr('stroke', 'white');
  });

  // --- Function to update circle positions ---
  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)
      .attr('cy', (d) => getCoords(d).cy);
  }

  updatePositions();

  // --- Keep markers aligned with map on move ---
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);
});
