// Minimal starter: loads regions_100.geojson and data/flows.csv
const map = L.map('map').setView([64.9, -19.0], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);

let regions = null;
let centroids = {};
let flows = [];

const svgLayer = L.svg().addTo(map);
const svg = d3.select('#map').select('svg');
const g = svg.append('g').attr('class','flows');

async function loadData(){
  const regionsUrl = 'regions_100.geojson'; // points to the file already in your repo root
  const flowsUrl = 'data/flows.csv';
  [regions, flows] = await Promise.all([
    d3.json(regionsUrl),
    d3.csv(flowsUrl, d => ({ origin_id: d.origin_id, dest_id: d.dest_id, type: d.type, year: d.year ? +d.year : null, unit: d.unit || 'persons', persons: d.persons ? +d.persons : 0 }))
  ]);

  regions.features.forEach(f => {
    // Make sure this matches a property in your geojson. We'll check later if needed.
    const id = f.properties.id || f.properties.ID || f.properties.GID || f.properties.region_id || f.properties.NAME || f.properties.name;
    if (id) centroids[id] = turf.centroid(f).geometry.coordinates; // [lng,lat]
    L.geoJSON(f, { style: { color:'#666', weight:1, fillOpacity:0.03 } }).addTo(map);
  });

  populateControls();
  drawFlows();
}

function populateControls(){
  const years = Array.from(new Set(flows.map(d=>d.year).filter(Boolean))).sort((a,b)=>a-b);
  const types = Array.from(new Set(flows.map(d=>d.type))).sort();
  const yearSelect = d3.select('#yearSelect'); years.forEach(y => yearSelect.append('option').attr('value', y).text(y));
  const typeSelect = d3.select('#typeSelect'); types.forEach(t => typeSelect.append('option').attr('value', t).text(t));
  typeSelect.selectAll('option').property('selected', true);

  const colorMap = getColorMap(types);
  d3.select('#legendItems').selectAll('div').data(types).join('div').html(d => `<span style="display:inline-block;width:14px;height:10px;background:${colorMap[d]};margin-right:6px;border:1px solid #ccc"></span>${d}`);

  d3.select('#apply').on('click', drawFlows);
  d3.select('#reset').on('click', ()=>{ d3.select('#yearSelect').property('value',''); d3.selectAll('#typeSelect option').property('selected', true); d3.select('#minPersons').property('value', 0); drawFlows(); });
}

function getColorMap(types){
  const palette = d3.schemeCategory10; const map = {}; types.forEach((t,i)=>map[t]=palette[i%palette.length]); return map;
}

function projectPoint(lnglat){ const p = map.latLngToLayerPoint([lnglat[1], lnglat[0]]); return [p.x,p.y]; }

function buildPathD(a,b){
  const pa = projectPoint(a), pb = projectPoint(b);
  const mx=(pa[0]+pb[0])/2, my=(pa[1]+pb[1])/2;
  const dx=pb[0]-pa[0], dy=pb[1]-pa[1];
  const norm=Math.sqrt(dx*dx+dy*dy)||1;
  const offset=Math.min(120, Math.max(10, norm*0.18));
  const ux=-dy/norm, uy=dx/norm;
  const cx=mx+ux*offset, cy=my+uy*offset;
  return `M${pa[0]},${pa[1]} Q${cx},${cy} ${pb[0]},${pb[1]}`;
}

function drawFlows(){
  const selectedYear = d3.select('#yearSelect').node().value;
  const selTypes = Array.from(d3.select('#typeSelect').node().selectedOptions).map(o=>o.value);
  const minPersons = +(d3.select('#minPersons').node().value||0);
  const filt = flows.filter(f => (selectedYear===''||f.year===+selectedYear) && selTypes.includes(f.type) && f.persons>=minPersons);

  const agg = d3.rollup(filt, v=>d3.sum(v,d=>d.persons), d=>d.origin_id, d=>d.dest_id, d=>d.type);
  const lines = [];
  for(const [o,destMap] of agg.entries()){
    for(const [d,typeMap] of destMap.entries()){
      for(const [t,persons] of typeMap.entries()){
        if(!centroids[o]||!centroids[d]) continue;
        lines.push({origin:o,dest:d,type:t,persons});
      }
    }
  }

  const types = Array.from(new Set(lines.map(d=>d.type)));
  const colorMap = getColorMap(types);

  const sel = g.selectAll('path.flow').data(lines, d=>`${d.origin}|${d.dest}|${d.type}`);
  sel.exit().remove();
  const enter = sel.enter().append('path').attr('class','flow').attr('fill','none').attr('stroke-linecap','round')
    .on('mouseover',(event,d)=>{ const html=`<strong>${d.type}</strong><br>${d.persons} persons<br>${regionName(d.origin)} → ${regionName(d.dest)}`; L.popup({closeButton:false,autoClose:true}).setLatLng(midpointLatLng(d)).setContent(html).openOn(map); })
    .on('mouseout', ()=> map.closePopup());
  const merged = enter.merge(sel);
  merged.attr('stroke', d=>colorMap[d.type]||'#888').attr('stroke-width', d=>Math.max(1, Math.sqrt(d.persons))).attr('opacity', 0.85).attr('d', d=>buildPathD(centroids[d.origin], centroids[d.dest]));
}

function regionName(id){
  const f = regions.features.find(ff=>{ const p=ff.properties; return p.id===id||p.ID===id||p.GID===id||p.region_id===id||p.name===id||p.NAME===id; });
  return f ? (f.properties.name||f.properties.NAME||id) : id;
}
function midpointLatLng(d){ const a=centroids[d.origin], b=centroids[d.dest]; return [(a[1]+b[1])/2,(a[0]+b[0])/2]; }

map.on('moveend', ()=> g.selectAll('path.flow').attr('d', d => buildPathD(centroids[d.origin], centroids[d.dest])));
loadData().catch(err=>{ console.error(err); alert('Data load failed — check console and data paths.'); });
