// Load map and GeoJSON, populate sidebar
// Load map and GeoJSON, populate sidebar with robust error handling + fallback
const map = L.map('map', {preferCanvas:true}).setView([64.9, -19.0], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OpenStreetMap contributors'}).addTo(map);

let geoLayer = null;
let features = [];

function showErrorMessage(msg){
  console.error(msg);
  const list = document.getElementById('list');
  if (list) list.innerHTML = `<li style="color:#a00"><strong>Error:</strong> ${msg}</li>`;
}

function createListItem(feature = {}, layer){
  const li = document.createElement('li');
  li.tabIndex = 0;
  // guard against missing properties
  const props = feature.properties || {};
  const title = props.name || props.id || 'Feature';
  li.innerHTML = `<strong>${title}</strong><div class="meta">${props.source || ''}</div>`;
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

async function load(){
  try{
    const res = await fetch('is.json');
    if(!res.ok) throw new Error(res.status+' '+res.statusText);
    const geo = await res.json();
    features = geo.features || [];

    // remove any existing layer
    if (geoLayer) {
      geoLayer.remove();
      geoLayer = null;
    }

    geoLayer = L.geoJSON(geo, {
      style: f=>({color:'#1e90ff', weight:2, fillOpacity:0.2}),
      onEachFeature: (f, l)=>{
        const title = f.properties && (f.properties.name || f.properties.id || 'Feature');
        l.bindPopup(`<strong>${title}</strong>`);
      }
    }).addTo(map);

    // build sidebar
    const list = document.getElementById('list');
    list.innerHTML = '';

    // Leaflet's eachLayer callback receives only (layer).
    // Use layer.feature (set by L.geoJSON) to access the original GeoJSON feature.
    geoLayer.eachLayer((layer)=>{
      const f = layer.feature || {}; // fallback if for some reason it's missing
      const li = createListItem(f, layer);
      list.appendChild(li);
    });

    // fit bounds if possible
    try {
      if (geoLayer && geoLayer.getBounds && geoLayer.getBounds().isValid()) {
        map.fitBounds(geoLayer.getBounds(), {padding:[20,20]});
      } else {
        map.setView([64.9, -19.0], 6);
      }
    } catch (e) {
      map.setView([64.9, -19.0], 6);
    }

  }catch(err){
    console.error(err);
    alert('Failed to load is.json — check console for details');
  }
}

// search
document.getElementById('search').addEventListener('input', function(e){
  const q = e.target.value.trim().toLowerCase();
  const list = document.getElementById('list');
  Array.from(list.children).forEach(li=>{
    const keep = q === '' || li.innerText.toLowerCase().includes(q);
    li.style.display = keep ? '' : 'none';
  });
});

document.getElementById('zoomAll').addEventListener('click', ()=>{
  if(geoLayer && geoLayer.getBounds) map.fitBounds(geoLayer.getBounds(), {padding:[20,20]});
});

load();
