{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Sample point (fixed)"},"geometry":{"type":"Point","coordinates":[-19.0,64.9]}}]}// Load map and GeoJSON, populate sidebar with robust error handling + fallback
const map = L.map('map', {preferCanvas:true}).setView([64.9, -19.0], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OpenStreetMap contributors'}).addTo(map);

let geoLayer = null;
let features = [];

function showErrorMessage(msg){
  console.error(msg);
  const list = document.getElementById('list');
  if (list) list.innerHTML = `<li style="color:#a00"><strong>Error:</strong> ${msg}</li>`;
}

function createListItem(feature, layer){
  const li = document.createElement('li');
  li.tabIndex = 0;
  const title = feature.properties && (feature.properties.name || feature.properties.id || 'Feature');
  li.innerHTML = `<strong>${title}</strong><div class="meta">${feature.properties && feature.properties.source ? feature.properties.source : ''}</div>`;
  li.addEventListener('click', ()=>{
    if(layer.getBounds){
      map.fitBounds(layer.getBounds(), {padding:[20,20]});
    } else if(layer.getLatLng){
      map.setView(layer.getLatLng(), 12);
    }
    layer.openPopup && layer.openPopup();
  });
  return li;
}

function populateSidebar(layerGeoJSON){
  features = layerGeoJSON.features || [];
  if (geoLayer) { geoLayer.remove(); geoLayer = null; }
  geoLayer = L.geoJSON(layerGeoJSON, {
    style: f=>({color:'#1e90ff', weight:2, fillOpacity:0.2}),
    onEachFeature: (f, l)=>{
      const title = f.properties && (f.properties.name || f.properties.id || 'Feature');
      l.bindPopup(`<strong>${title}</strong>`);
    }
  }).addTo(map);

  const list = document.getElementById('list');
  if (!list) return;
  list.innerHTML = '';
  geoLayer.eachLayer((layer, idx)=>{
    const f = features[idx] || {};
    const li = createListItem(f, layer);
    list.appendChild(li);
  });

  try {
    if(geoLayer.getBounds && geoLayer.getBounds().isValid()){
      map.fitBounds(geoLayer.getBounds(), {padding:[20,20]});
    } else {
      map.setView([64.9, -19.0], 6);
    }
  } catch(e){
    map.setView([64.9, -19.0], 6);
  }
}

async function tryFetchGeo(url){
  const res = await fetch(url, {cache:'no-cache'});
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    // include nearby snippet to help debugging
    const match = err.message && err.message.match(/position (\d+)/);
    let snippet = text.slice(0, 300);
    if (match && match[1]) {
      const p = parseInt(match[1], 10);
      snippet = text.slice(Math.max(0, p - 120), Math.min(text.length, p + 120));
    }
    const message = `Failed to parse JSON from ${url}: ${err.message}. Snippet:\n${snippet.replace(/\n/g,'\\n')}`;
    const parseError = new Error(message);
    parseError.originalText = text;
    throw parseError;
  }
}

async function loadGeoJSON(){
  const relativeUrl = 'is.json';
  const absoluteUrl = 'https://aycaer21is-jpg.github.io/json-server/is.json';

  try {
    const geo = await tryFetchGeo(relativeUrl);
    populateSidebar(geo);
    return;
  } catch (err1) {
    console.warn('Relative fetch/parse failed:', err1);
    try {
      const geo = await tryFetchGeo(absoluteUrl);
      populateSidebar(geo);
      return;
    } catch (err2) {
      console.error('Absolute fetch/parse failed:', err2);
      if (err2.message) console.error(err2.message);
      showErrorMessage('Failed to load or parse is.json (see console). Using fallback data so the map remains visible.');
      const fallback = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: { name: "Fallback point" },
          geometry: { type: "Point", coordinates: [-19.0, 64.9] }
        }]
      };
      populateSidebar(fallback);
    }
  }
}

document.getElementById('search').addEventListener('input', function(e){
  const q = e.target.value.trim().toLowerCase();
  const list = document.getElementById('list');
  if (!list) return;
  Array.from(list.children).forEach(li=>{
    const keep = q === '' || li.innerText.toLowerCase().includes(q);
    li.style.display = keep ? '' : 'none';
  });
});
document.getElementById('zoomAll').addEventListener('click', ()=>{
  if(geoLayer && geoLayer.getBounds) map.fitBounds(geoLayer.getBounds(), {padding:[20,20]});
});

loadGeoJSON();name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v1
        with:
          path: './' # publish the repository root

  deploy-pages:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v1
