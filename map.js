// Import Mapbox and D3 as ES Modules
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Set your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoicHNhbmRlZXAiLCJhIjoiY21hcWIzNzFkMDgwYTJqcTZ5a29ramhmcyJ9.3xuzDkrrcQjg-Q7F80JwFQ';

let timeFilter = -1; // Global variable to store the current slider filter value

const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterTripsbyTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips
    : trips.filter((trip) => {
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
      });
}

function computeStationTraffic(stations, trips) {
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

  return stations.map((station) => {
    const id = station.short_name;
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });
}

let radiusScale = d3.scaleSqrt().range([0, 25]);

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

function updateScatterPlot(filteredTrips, stations, circles) {
  const filteredStations = computeStationTraffic(stations, filteredTrips);
  timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

  circles
    .data(filteredStations, (d) => d.short_name)
    .join('circle')
    .attr('r', (d) => radiusScale(d.totalTraffic))
    .style('--departure-ratio', (d) => stationFlow(d.departures / d.totalTraffic));
}

map.on('load', async () => {
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

  const svg = d3.select('#map').select('svg');
  const tooltip = d3.select('#tooltip');

  const stationData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
  let stations = stationData.data.stations;

  let trips = await d3.csv(
    'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
    (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    }
  );

  stations = computeStationTraffic(stations, trips);
  radiusScale.domain([0, d3.max(stations, (d) => d.totalTraffic)]);

  const circles = svg
    .selectAll('circle')
    .data(stations, (d) => d.short_name)
    .enter()
    .append('circle')
    .attr('r', (d) => radiusScale(d.totalTraffic))
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1.5)
    .attr('opacity', 0.8)
    .style('--departure-ratio', (d) => stationFlow(d.departures / d.totalTraffic))
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

  function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
  }

  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)
      .attr('cy', (d) => getCoords(d).cy);
  }

  updatePositions();
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');

  function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }

    const filteredTrips = filterTripsbyTime(trips, timeFilter);
    updateScatterPlot(filteredTrips, stations, circles);
  }

  timeSlider.addEventListener('input', updateTimeDisplay);
  updateTimeDisplay();
});