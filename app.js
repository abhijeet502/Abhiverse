/* AuroraVerse — app.js
   Combines:
    - canvas aurora waves
    - particles
    - neural grid
    - Leaflet map with simulated live data
    - UI interactions and auto-scroll between sections
*/

(() => {
  // -----------------------
  // small helpers
  const rand = (a,b) => Math.random()*(b-a)+a;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const hexToRgb = h => {
    const p = h.replace('#','');
    return { r: parseInt(p.slice(0,2),16), g: parseInt(p.slice(2,4),16), b: parseInt(p.slice(4,6),16) };
  };

  // theme palettes
  const palettes = [
    {a:"#ff6ec7", b:"#7c5cff", c:"#38bdf8"},
    {a:"#ff9bb8", b:"#8e6bff", c:"#74ecf0"},
    {a:"#ffb3d6", b:"#c08eff", c:"#9be7ff"}
  ];
  let activePal = palettes[0];
  function applyPal(p){
    document.documentElement.style.setProperty('--accentA', p.a);
    document.documentElement.style.setProperty('--accentB', p.b);
    document.documentElement.style.setProperty('--accentC', p.c);
  }
  applyPal(activePal);

  // -----------------------
  // canvases
  const cAur = document.getElementById('aurora');
  const cPar = document.getElementById('particles');
  const cGrid = document.getElementById('grid');
  const ctxA = cAur.getContext('2d');
  const ctxP = cPar.getContext('2d');
  const ctxG = cGrid.getContext('2d');

  function resize(){
    const w = innerWidth, h = innerHeight;
    [cAur,cPar,cGrid].forEach(c=>{
      c.width = w * devicePixelRatio;
      c.height = h * devicePixelRatio;
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      const ctx = c.getContext('2d');
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    });
  }
  window.addEventListener('resize', ()=>{ resize(); initGrid(); });
  resize();

  // -----------------------
  // AURORA LAYERS
  const auroraLayers = [];
  for(let i=0;i<4;i++){
    auroraLayers.push({amp:rand(40,120), speed:rand(0.002,0.01), phase:rand(0,Math.PI*2), thickness:120 - i*18});
  }
  function drawAurora(t){
    const w = cAur.width / devicePixelRatio;
    const h = cAur.height / devicePixelRatio;
    ctxA.clearRect(0,0,w,h);
    auroraLayers.forEach((L,i)=>{
      const grd = ctxA.createLinearGradient(0, h*0.2, w, h*0.8);
      const ca = hexToRgb(activePal.a), cb = hexToRgb(activePal.b);
      const a1 = 0.06 + i*0.02;
      grd.addColorStop(0, `rgba(${ca.r},${ca.g},${ca.b},${a1})`);
      grd.addColorStop(0.6, `rgba(${cb.r},${cb.g},${cb.b},${a1+0.02})`);
      grd.addColorStop(1, `rgba(255,255,255,0.01)`);
      ctxA.fillStyle = grd;
      ctxA.beginPath();
      ctxA.moveTo(0,h);
      const baseY = h*0.35 + i*38;
      for(let x=0;x<=w;x+=6){
        const y = baseY + Math.sin((t*L.speed)+(x/220)+L.phase) * L.amp * (1 + i*0.06);
        ctxA.lineTo(x, y - i*6);
      }
      ctxA.lineTo(w,h); ctxA.closePath(); ctxA.fill();
    });
  }

  // -----------------------
  // PARTICLES
  let PARTICLE_COUNT = Math.floor((innerWidth*innerHeight)/14000);
  const particles = [];
  function initParticles(){
    particles.length = 0;
    PARTICLE_COUNT = Math.max(150, Math.floor((innerWidth*innerHeight)/14000));
    for(let i=0;i<PARTICLE_COUNT;i++){
      particles.push({
        x: rand(0,innerWidth),
        y: rand(0,innerHeight),
        vx: (Math.random()-0.5)*0.6,
        vy: (Math.random()-0.5)*0.4,
        s: rand(0.6,3),
        life: Math.random()
      });
    }
  }
  initParticles();

  function drawParticles(t){
    const w = cPar.width/devicePixelRatio, h = cPar.height/devicePixelRatio;
    ctxP.clearRect(0,0,w,h);
    particles.forEach(p=>{
      p.x += p.vx * (1 + Math.sin(t*0.001 + p.s));
      p.y += p.vy * (1 + Math.cos(t*0.001 + p.s));
      if(p.x < -30) p.x = w+30;
      if(p.x > w+30) p.x = -30;
      if(p.y < -30) p.y = h+30;
      if(p.y > h+30) p.y = -30;
      const grd = ctxP.createRadialGradient(p.x,p.y,0,p.x,p.y,p.s*9);
      const ca = hexToRgb(activePal.a);
      grd.addColorStop(0, `rgba(${ca.r},${ca.g},${ca.b},${0.9*p.life})`);
      grd.addColorStop(0.6, `rgba(${ca.r},${ca.g},${ca.b},${0.08*p.life})`);
      grd.addColorStop(1, `rgba(255,255,255,0)`);
      ctxP.fillStyle = grd;
      ctxP.beginPath(); ctxP.arc(p.x,p.y,p.s,0,Math.PI*2); ctxP.fill();
    });
  }

  // -----------------------
  // NEURAL GRID
  let gridPoints = [];
  let GRID_COLS = 22;
  function initGrid(){
    gridPoints.length = 0;
    GRID_COLS = parseInt(document.getElementById('rngGrid')?.value || 22,10);
    const w = innerWidth, h = innerHeight;
    const rows = Math.max(6, Math.round((h/w)*GRID_COLS));
    for(let r=0;r<rows;r++){
      for(let c=0;c<GRID_COLS;c++){
        const x = (c/(GRID_COLS-1))*w + rand(-18,18);
        const y = (r/(rows-1))*h + rand(-18,18);
        gridPoints.push({x,y,ox:x,oy:y,phase:rand(0,Math.PI*2),conn:[]});
      }
    }
    // create sparse connections
    gridPoints.forEach((p,i)=>{
      p.conn = [];
      for(let j=0;j<gridPoints.length;j++){
        if(i===j) continue;
        const q = gridPoints[j];
        const d = Math.hypot(p.x-q.x,p.y-q.y);
        if(d < Math.max(innerWidth,innerHeight)/6) p.conn.push(j);
      }
    });
  }
  initGrid();

  function drawGrid(t){
    const w = cGrid.width/devicePixelRatio, h = cGrid.height/devicePixelRatio;
    ctxG.clearRect(0,0,w,h);
    gridPoints.forEach((p,i)=>{
      p.phase += 0.002 + (i%3)*0.0002;
      p.x = p.ox + Math.sin(p.phase*1.3 + i)*4;
      p.y = p.oy + Math.cos(p.phase*1.1 + i)*4;
      // lines
      p.conn.forEach(ci=>{
        const q = gridPoints[ci];
        const d = Math.hypot(p.x-q.x,p.y-q.y);
        const alpha = clamp(1 - d/(innerWidth/3), 0, 0.6);
        if(alpha <= 0) return;
        const g = ctxG.createLinearGradient(p.x,p.y,q.x,q.y);
        const cb = hexToRgb(activePal.b), cc = hexToRgb(activePal.c);
        g.addColorStop(0, `rgba(${cb.r},${cb.g},${cb.b},${alpha*0.3})`);
        g.addColorStop(1, `rgba(${cc.r},${cc.g},${cc.b},${alpha*0.02})`);
        ctxG.strokeStyle = g; ctxG.lineWidth = 1;
        ctxG.beginPath(); ctxG.moveTo(p.x,p.y); ctxG.lineTo(q.x,q.y); ctxG.stroke();
      });
      // dots
      const grd = ctxG.createRadialGradient(p.x,p.y,0,p.x,p.y,6);
      const ca = hexToRgb(activePal.a);
      grd.addColorStop(0, `rgba(${ca.r},${ca.g},${ca.b},0.9)`);
      grd.addColorStop(1, `rgba(${ca.r},${ca.g},${ca.b},0)`);
      ctxG.fillStyle = grd; ctxG.beginPath(); ctxG.arc(p.x,p.y,2.4,0,Math.PI*2); ctxG.fill();
    });
  }

  // -----------------------
  // animation loop
  let last = performance.now();
  function loop(now){
    const dt = now - last; last = now;
    drawAurora(now);
    drawParticles(now);
    drawGrid(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // -----------------------
  // UI interactions (buttons)
  const btnInspire = document.getElementById('btnInspire');
  const btnPulse = document.getElementById('btnPulse');
  const btnShuffle = document.getElementById('btnShuffle');
  const rngParticles = document.getElementById('rngParticles');
  const rngGrid = document.getElementById('rngGrid');

  btnInspire.addEventListener('click', ()=>{
    const p = palettes[Math.floor(Math.random()*palettes.length)];
    activePal = p; applyPal(p);
    auroraLayers.forEach(L=> L.amp *= 1.12);
    setTimeout(()=> auroraLayers.forEach(L=> L.amp *= 0.88), 700);
    particles.forEach(pt=> { pt.vx *= 1.3; pt.vy *= 1.2; });
    animateServerBars();
  });

  btnPulse.addEventListener('click', ()=>{
    for(let i=0;i<60;i++){
      particles.push({
        x: innerWidth*0.5 + rand(-160,160),
        y: innerHeight*0.5 + rand(-160,160),
        vx: rand(-3,3), vy: rand(-3,3), s: rand(1,3), life:1
      });
    }
  });

  btnShuffle.addEventListener('click', ()=> {
    gridPoints.forEach(p => { p.ox += rand(-40,40); p.oy += rand(-40,40); });
  });

  rngParticles?.addEventListener('input', (e)=>{
    const v = Number(e.target.value);
    // adjust desired count smoothly
    const desired = Math.max(120, Math.min(4000, v));
    while(particles.length < desired) particles.push({ x:rand(0,innerWidth), y:rand(0,innerHeight), vx:(Math.random()-0.5)*0.6, vy:(Math.random()-0.5)*0.4, s:rand(0.6,3), life:1});
    while(particles.length > desired) particles.pop();
  });

  rngGrid?.addEventListener('change', ()=>{
    initGrid();
  });

  // -----------------------
  // server bars & uptime
  const barEls = document.querySelectorAll('.bar-fill');
  function animateServerBars(){
    barEls.forEach((el)=>{
      const v = Math.floor(rand(18,86));
      el.style.width = v + '%';
      el.dataset.load = v;
    });
  }
  animateServerBars();
  setInterval(animateServerBars, 6000);

  let startTS = Date.now();
  function updateUptime(){
    const e = Date.now() - startTS;
    const hh = String(Math.floor(e/3600000)).padStart(2,'0');
    const mm = String(Math.floor((e%3600000)/60000)).padStart(2,'0');
    const ss = String(Math.floor((e%60000)/1000)).padStart(2,'0');
    const el = document.getElementById('feedTime');
    if(el) el.textContent = `${hh}:${mm}:${ss}`;
    requestAnimationFrame(updateUptime);
  }
  updateUptime();

  // -----------------------
  // BOOT overlay
  const boot = document.getElementById('boot');
  const bootBar = document.getElementById('boot-bar');
  function runBoot(){
    let p = 0;
    const steps = ['Powering cores...','Syncing grids...','Warming aurora shaders...','Spawning particles...'];
    const lines = document.getElementById('boot-lines');
    lines.innerHTML = steps.map(s=>`<div class="line">${s}</div>`).join('');
    const t = setInterval(()=>{
      p += rand(8,16);
      bootBar.style.width = clamp(p,0,100) + '%';
      if(p >= 100){
        clearInterval(t);
        boot.style.opacity = '0';
        setTimeout(()=> boot.style.display = 'none', 700);
      }
    }, 360);
  }
  runBoot();

  // -----------------------
  // MAP (Leaflet) + simulated data
  let map, markersLayer, heatLayer;
  function setupMap(){
    try {
      map = L.map('mapid', { zoomControl:false }).setView([20,0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: ''
      }).addTo(map);

      markersLayer = L.layerGroup().addTo(map);
      heatLayer = null; // placeholder - can add leaflet-heat if needed
      // initial mock feed
      refreshMapData(true);
    } catch (err) {
      console.warn('Leaflet not available or map error:', err);
      document.getElementById('mapStatus').textContent = 'Map could not load (offline).';
    }
  }

  // Simulated "live" data
  function generateMockFeeds(){
    const cities = [
      {name:'London', lat:51.5074, lon:-0.1278},
      {name:'New York', lat:40.7128, lon:-74.0060},
      {name:'Mumbai', lat:19.0760, lon:72.8777},
      {name:'Tokyo', lat:35.6762, lon:139.6503},
      {name:'Sydney', lat:-33.8688, lon:151.2093},
      {name:'Berlin', lat:52.5200, lon:13.4050},
      {name:'São Paulo', lat:-23.5505, lon:-46.6333}
    ];
    return cities.map(c => ({
      title: ['Insight','Trend','Note','Alert'][Math.floor(Math.random()*4)] + ' — ' + ['AI','Design','Web','Cloud'][Math.floor(Math.random()*4)],
      lat: c.lat + (Math.random()-0.5)*0.6,
      lon: c.lon + (Math.random()-0.5)*0.6,
      value: Math.floor(rand(10,900))
    }));
  }

  function refreshMapData(init=false){
    const feed = generateMockFeeds();
    document.getElementById('feedCount').textContent = feed.length;
    document.getElementById('mapStatus').textContent = 'Displaying simulated live feeds';
    document.getElementById('feedTime').textContent = new Date().toLocaleTimeString();
    if(!map || !markersLayer){
      return;
    }
    markersLayer.clearLayers();
    feed.forEach(f=>{
      const pul = L.circle([f.lat,f.lon], { radius: 30000 + f.value*200, color: activePal.a, opacity:0.5, fillOpacity:0.06 }).addTo(markersLayer);
      const marker = L.circleMarker([f.lat, f.lon], { radius: 8, color: activePal.b, fillColor: activePal.a, fillOpacity:1, weight:1 });
      marker.bindPopup(`<strong>${f.title}</strong><br/>value: ${f.value}`).addTo(markersLayer);
    });
    if(!init) animateServerBars();
  }

  document.getElementById('btnRefreshData').addEventListener('click', ()=> refreshMapData(false));
  document.getElementById('btnShowHeat').addEventListener('click', ()=>{
    // toggle simple heat-like overlay (just pulses by repainting circles)
    const el = document.getElementById('mapStatus');
    if(el.dataset.heat === 'on'){ el.dataset.heat = 'off'; el.textContent = 'Heat off'; refreshMapData(); return; }
    el.dataset.heat = 'on'; el.textContent = 'Heat visual active';
    // quick pulse effect: spawn translucent circles that grow then fade (done via markersLayer)
    const pulses = generateMockFeeds();
    pulses.forEach((p,i)=>{
      const c = L.circle([p.lat,p.lon], { radius:10000, color: activePal.b, opacity:0.18, fillOpacity:0.01 }).addTo(markersLayer);
      setTimeout(()=> markersLayer.removeLayer(c), 2200 + i*120);
    });
  });

  // init map after DOM load
  window.addEventListener('load', ()=> {
    setupMap();
    // auto-refresh feed periodically
    setInterval(()=> refreshMapData(false), 12000);
  });

  // -----------------------
  // AUTO-SCROLL between sections
  const sections = Array.from(document.querySelectorAll('.section'));
  let automatic = true;
  const chkAuto = document.getElementById('chkAuto');
  chkAuto && chkAuto.addEventListener('change', (e)=> automatic = e.target.checked);

  let currentIndex = 0;
  const scrollInterval = 12000; // 12s per section
  let autoTimer = null;

  function scrollToIndex(i){
    if(i < 0) i = sections.length - 1;
    if(i >= sections.length) i = 0;
    currentIndex = i;
    sections[i].scrollIntoView({behavior:'smooth',block:'start'});
  }

  function startAuto(){
    stopAuto();
    autoTimer = setInterval(()=>{
      if(automatic) scrollToIndex((currentIndex+1) % sections.length);
    }, scrollInterval);
  }
  function stopAuto(){ if(autoTimer) clearInterval(autoTimer); autoTimer = null; }

  // pause auto on pointer interaction
  ['pointerenter','mousemove','touchstart'].forEach(ev=>{
    document.addEventListener(ev, ()=> { automatic = false; chkAuto && (chkAuto.checked = false); stopAuto(); }, {passive:true});
  });
  // resume with control
  document.getElementById('btnInspire')?.addEventListener('dblclick', ()=> { automatic = true; chkAuto && (chkAuto.checked = true); startAuto(); });

  // nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const id = btn.dataset.target;
      const el = document.getElementById(id);
      if(el){ el.scrollIntoView({behavior:'smooth'}); automatic=false; chkAuto && (chkAuto.checked=false); stopAuto();}
    });
  });

  startAuto();

  // -----------------------
  // small housekeeping (trim/scale particles)
  setInterval(()=> {
    if(particles.length > Math.max(3000, PARTICLE_COUNT*2)) particles.splice(0, particles.length - Math.floor(PARTICLE_COUNT*1.6));
  }, 3500);

  // allow hovering to pause auto-scroll
  document.querySelectorAll('.section').forEach(sec=>{
    sec.addEventListener('mouseenter', ()=> { automatic = false; chkAuto && (chkAuto.checked=false); stopAuto(); });
    sec.addEventListener('mouseleave', ()=> { if(chkAuto && chkAuto.checked) { automatic=true; startAuto(); }});
  });

  // final console
  console.log('AuroraVerse initialized — enjoy. Footer: Crafted with ❤️ by Abhi');
})();
