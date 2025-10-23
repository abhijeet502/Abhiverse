/* AuroraVerse — app.js
   Combines:
    - canvas aurora waves, particles, neural grid
    - Leaflet map with simulated live data
    - UI interactions and manual scroll to sections
    - Real-time data from free APIs (WorldTimeAPI, Open-Meteo)
*/

(() => {
  // -----------------------
  // Core Helpers
  const rand = (a,b) => Math.random()*(b-a)+a;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const hexToRgb = h => {
    const p = h.replace('#','');
    return { r: parseInt(p.slice(0,2),16), g: parseInt(p.slice(2,4),16), b: parseInt(p.slice(4,6),16) };
  };

  // Theme palettes (for the "Inspire Me" button)
  const palettes = [
    {a:"#ff1aff", b:"#4d00ff", c:"#00ffff"}, // Default (Neon)
    {a:"#ff9bb8", b:"#8e6bff", c:"#74ecf0"}, // Violet/Aqua
    {a:"#6bff98", b:"#0066ff", c:"#ff0066"}  // Green/Blue/Red
  ];
  let activePal = palettes[0];
  const root = document.documentElement.style;
  function applyPal(p){
    root.setProperty('--accentA', p.a);
    root.setProperty('--accentB', p.b);
    root.setProperty('--accentC', p.c);
    if(map) refreshMapData(false); // Update map colors on palette change
  }
  applyPal(activePal);

  // -----------------------
  // Canvas Setup
  const cAur = document.getElementById('aurora');
  const cPar = document.getElementById('particles');
  const cGrid = document.getElementById('grid');
  const ctxA = cAur?.getContext('2d');
  const ctxP = cPar?.getContext('2d');
  const ctxG = cGrid?.getContext('2d');

  function resize(){
    const w = innerWidth, h = innerHeight;
    [cAur,cPar,cGrid].forEach(c=>{
      if(!c) return;
      c.width = w * devicePixelRatio;
      c.height = h * devicePixelRatio;
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      const ctx = c.getContext('2d');
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    });
  }
  window.addEventListener('resize', ()=>{ resize(); initGrid(); initParticles(); });
  resize();

  // -----------------------
  // AURORA LAYERS (Wave Effect)
  const auroraLayers = [];
  for(let i=0;i<4;i++){
    auroraLayers.push({amp:rand(40,120), speed:rand(0.002,0.01), phase:rand(0,Math.PI*2), thickness:120 - i*18});
  }
  function drawAurora(t){
    if(!ctxA || !cAur) return;
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
  // PARTICLES (Floating Dots)
  let particles = [];
  let PARTICLE_COUNT = 0;

  function initParticles(){
    particles.length = 0;
    PARTICLE_COUNT = parseInt(document.getElementById('rngParticles')?.value || 900, 10);
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
    if(!ctxP || !cPar) return;
    const w = cPar.width/devicePixelRatio, h = cPar.height/devicePixelRatio;
    ctxP.clearRect(0,0,w,h);
    particles.forEach(p=>{
      p.x += p.vx * (1 + Math.sin(t*0.001 + p.s));
      p.y += p.vy * (1 + Math.cos(t*0.001 + p.s));
      // Wrap particles
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
  // NEURAL GRID (Background Lines)
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
      const threshold = Math.max(innerWidth,innerHeight)/6;
      for(let j=0;j<gridPoints.length;j++){
        if(i===j) continue;
        const q = gridPoints[j];
        const d = Math.hypot(p.x-q.x,p.y-q.y);
        if(d < threshold) p.conn.push(j);
      }
    });
  }
  initGrid();

  function drawGrid(t){
    if(!ctxG || !cGrid) return;
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
  // Animation Loop
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
  // UI Interactions
  const btnInspire = document.getElementById('btnInspire');
  const btnPulse = document.getElementById('btnPulse');
  const btnShuffle = document.getElementById('btnShuffle');
  const rngParticles = document.getElementById('rngParticles');
  const rngGrid = document.getElementById('rngGrid');
  const chkAuto = document.getElementById('chkAuto');

  btnInspire?.addEventListener('click', ()=>{
    const p = palettes[Math.floor(Math.random()*palettes.length)];
    activePal = p; applyPal(p);
    auroraLayers.forEach(L=> L.amp *= 1.12);
    setTimeout(()=> auroraLayers.forEach(L=> L.amp *= 0.88), 700);
    particles.forEach(pt=> { pt.vx *= 1.3; pt.vy *= 1.2; });
    animateServerBars();
  });

  btnPulse?.addEventListener('click', ()=>{
    for(let i=0;i<60;i++){
      particles.push({
        x: innerWidth*0.5 + rand(-160,160),
        y: innerHeight*0.5 + rand(-160,160),
        vx: rand(-3,3), vy: rand(-3,3), s: rand(1,3), life:1
      });
    }
  });

  btnShuffle?.addEventListener('click', ()=> {
    gridPoints.forEach(p => { p.ox += rand(-40,40); p.oy += rand(-40,40); });
  });

  rngParticles?.addEventListener('input', (e)=>{
    const desired = Number(e.target.value);
    PARTICLE_COUNT = desired;
    while(particles.length < desired) particles.push({ x:rand(0,innerWidth), y:rand(0,innerHeight), vx:(Math.random()-0.5)*0.6, vy:(Math.random()-0.5)*0.4, s:rand(0.6,3), life:1});
    while(particles.length > desired) particles.pop();
  });

  rngGrid?.addEventListener('change', ()=>{
    initGrid();
  });

  // -----------------------
  // Server Bars & Uptime
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
  const feedTimeEl = document.getElementById('feedTime');
  function updateUptime(){
    const e = Date.now() - startTS;
    const hh = String(Math.floor(e/3600000)).padStart(2,'0');
    const mm = String(Math.floor((e%3600000)/60000)).padStart(2,'0');
    const ss = String(Math.floor((e%60000)/1000)).padStart(2,'0');
    if(feedTimeEl) feedTimeEl.textContent = `${hh}:${mm}:${ss}`;
    requestAnimationFrame(updateUptime);
  }
  updateUptime();

  // -----------------------
  // BOOT overlay
  const boot = document.getElementById('boot');
  const bootBar = document.getElementById('boot-bar');
  function runBoot(){
    let p = 0;
    const steps = ['Powering cores...','Syncing grids...','Warming aurora shaders...','Spawning particles...','Establishing network links...'];
    const lines = document.getElementById('boot-lines');
    lines.innerHTML = steps.map(s=>`<div class="line">${s}</div>`).join('');
    const t = setInterval(()=>{
      p += rand(8,16);
      if(bootBar) bootBar.style.width = clamp(p,0,100) + '%';
      if(p >= 100){
        clearInterval(t);
        if(boot) boot.style.opacity = '0';
        setTimeout(()=> { if(boot) boot.style.display = 'none'; }, 700);
      }
    }, 360);
  }
  runBoot();

  // -----------------------
  // MAP (Leaflet) + Simulated Data
  let map, markersLayer;
  const MAP_COORDS = [20,0]; // Central map view

  function setupMap(){
    try {
      map = L.map('mapid', { zoomControl:false }).setView(MAP_COORDS, 2);
      // Custom dark map tile layer from openstreetmap is hard, so we use a filtered standard one
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, attribution: '', minZoom:2
      }).addTo(map);

      markersLayer = L.layerGroup().addTo(map);
      refreshMapData(true);
    } catch (err) {
      console.warn('Leaflet not available or map error:', err);
      document.getElementById('mapStatus').textContent = 'Map could not load (Leaflet error).';
    }
  }

  // Simulated "live" data feeds (not API)
  function generateMockFeeds(){
    const cities = [
      {name:'London', lat:51.5074, lon:-0.1278},
      {name:'New York', lat:40.7128, lon:-74.0060},
      {name:'Mumbai', lat:19.0760, lon:72.8777},
      {name:'Tokyo', lat:35.6762, lon:139.6503},
      {name:'Sydney', lat:-33.8688, lon:151.2093},
      {name:'Berlin', lat:52.5200, lon:13.4050},
    ];
    return cities.map(c => ({
      title: ['Insight','Trend','Note','Alert'][Math.floor(Math.random()*4)] + ' — ' + ['AI Core','Design Node','Web Cluster','Cloud Sync'][Math.floor(Math.random()*4)],
      lat: c.lat + (Math.random()-0.5)*1.2, // increased jitter
      lon: c.lon + (Math.random()-0.5)*1.2,
      value: Math.floor(rand(10,900))
    }));
  }

  function refreshMapData(init=false){
    const feed = generateMockFeeds();
    const feedCountEl = document.getElementById('feedCount');
    if(feedCountEl) feedCountEl.textContent = feed.length;
    
    const mapStatusEl = document.getElementById('mapStatus');
    if(mapStatusEl) mapStatusEl.textContent = 'Displaying simulated activity streams';
    if(feedTimeEl) feedTimeEl.textContent = new Date().toLocaleTimeString();

    if(!map || !markersLayer) return;
    markersLayer.clearLayers();

    const colorA = activePal.a;
    const colorB = activePal.b;

    feed.forEach(f=>{
      // Pulse Circle
      L.circle([f.lat,f.lon], { 
        radius: 30000 + f.value*200, 
        color: colorA, 
        opacity:0.3, 
        fillOpacity:0.04, 
        weight:1 
      }).addTo(markersLayer);
      
      // Marker Dot
      const marker = L.circleMarker([f.lat, f.lon], { 
        radius: 6, 
        color: colorB, 
        fillColor: colorA, 
        fillOpacity:1, 
        weight:1 
      });
      marker.bindPopup(`<strong>${f.title}</strong><br/>Value: ${f.value}`).addTo(markersLayer);
    });
    if(!init) animateServerBars();
  }

  document.getElementById('btnRefreshData')?.addEventListener('click', ()=> refreshMapData(false));
  document.getElementById('btnShowHeat')?.addEventListener('click', ()=>{
    // Simplified pulse effect
    const pulses = generateMockFeeds();
    pulses.forEach((p,i)=>{
      const c = L.circle([p.lat,p.lon], { radius:50000, color: activePal.c, opacity:0.3, fillOpacity:0.05, weight:2 }).addTo(markersLayer);
      setTimeout(()=> markersLayer.removeLayer(c), 1800 + i*150);
    });
    const btn = document.getElementById('btnShowHeat');
    if(btn) btn.textContent = 'Pulsed! (Toggle Pulses)';
    setTimeout(() => { if(btn) btn.textContent = 'Toggle Pulses'; }, 2000);
  });

  // -----------------------
  // SYSTEM FEED (Real & Simulated Data)

  const timeDataContent = document.getElementById('time-data-content');
  const newsDataContent = document.getElementById('news-data-content');
  const weatherDataEl = document.getElementById('weather-data');

  // API 1: World Time (Free & Public)
  async function fetchTimeData(){
    try {
      const resp = await fetch('https://worldtimeapi.org/api/timezone/Europe/London');
      const data = await resp.json();
      if(timeDataContent){
        timeDataContent.innerHTML = `
          <span style="color:var(--accentA); font-size:1rem;">Europe/London Node Time</span><br/>
          ${new Date(data.datetime).toLocaleTimeString()}
        `;
      }
    } catch (error) {
      if(timeDataContent) timeDataContent.textContent = 'ERROR: Time API offline.';
    }
  }

  // API 2: Open-Meteo Weather (Free & Public)
  async function fetchWeatherData(){
     // Using coordinates for Tokyo
    try {
      const resp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current_weather=true');
      const data = await resp.json();
      if(weatherDataEl && data.current_weather){
        weatherDataEl.innerHTML = `
          <span style="color:var(--accentA);">Tokyo, Japan (Lat: ${data.latitude}, Lon: ${data.longitude})</span><br/>
          <span style="color:var(--accentC);">Current Temp:</span> ${data.current_weather.temperature}°C<br/>
          <span style="color:var(--accentC);">Wind Speed:</span> ${data.current_weather.windspeed} km/h<br/>
          <span style="color:var(--accentC);">Time:</span> ${data.current_weather.time.split('T')[1]}
        `;
      }
    } catch (error) {
      if(weatherDataEl) weatherDataEl.textContent = 'ERROR: Weather API offline.';
    }
  }

  // Simulated News Feed (to avoid API keys)
  function simulateNewsFeed(){
    const topics = ['AI Alignment','Quantum Computing','WebGPU Standard','Global Energy Grid','Space-time Data Echo'];
    const actions = ['New breakthrough detected','Synchronization complete','Anomaly reported','Deployment initiated','Core metrics stable'];
    let news = '';
    for(let i = 0; i < 5; i++) {
      news += `<span style="color:var(--accentC)">[${String(i).padStart(2, '0')}:${new Date().toLocaleTimeString()}]</span> ${topics[Math.floor(rand(0,5))]} - ${actions[Math.floor(rand(0,5))]}<br/>`;
    }
    if(newsDataContent) newsDataContent.innerHTML = news;
  }
  
  // Initial & Interval Data Fetch
  function fetchData(){
    fetchTimeData();
    fetchWeatherData();
    simulateNewsFeed();
  }
  
  // Wait for load to ensure DOM elements exist
  window.addEventListener('load', ()=> {
    setupMap();
    fetchData(); 
    // Data refresh intervals
    setInterval(()=> refreshMapData(false), 12000);
    setInterval(fetchData, 8000);
  });

  // -----------------------
  // MANUAL & AUTO-SCROLL
  const sections = Array.from(document.querySelectorAll('.section'));
  let automatic = chkAuto?.checked || true;
  const scrollInterval = 12000;
  let autoTimer = null;

  chkAuto?.addEventListener('change', (e)=> automatic = e.target.checked);

  function scrollToIndex(i){
    let idx = i;
    if(idx < 0) idx = sections.length - 1;
    if(idx >= sections.length) idx = 0;
    
    // Smooth scroll only on the main wrapper
    document.querySelector('.parallax-wrap').scrollTo({
      top: sections[idx].offsetTop,
      behavior: 'smooth'
    });
  }

  function startAuto(){
    stopAuto();
    let currentIndex = 0; // The index of the section at the top of the viewport
    
    autoTimer = setInterval(()=>{
      if(!automatic) return;
      // Get the current index based on scroll position
      const scrollPos = document.querySelector('.parallax-wrap').scrollTop;
      currentIndex = sections.findIndex(sec => sec.offsetTop > scrollPos) - 1;
      if (currentIndex < 0) currentIndex = sections.length - 1;

      scrollToIndex((currentIndex+1) % sections.length);
    }, scrollInterval);
  }
  function stopAuto(){ if(autoTimer) clearInterval(autoTimer); autoTimer = null; }

  // Navigation buttons scroll using the new wrapper
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const id = btn.dataset.target;
      const el = document.getElementById(id);
      if(el){ 
        // Scroll the parallax wrapper to the section's position
        document.querySelector('.parallax-wrap').scrollTo({
            top: el.offsetTop,
            behavior: 'smooth'
        });
        automatic=false; chkAuto && (chkAuto.checked=false); stopAuto();
      }
    });
  });

  startAuto();

  // Final Console Log
  console.log('AuroraVerse initialized — enjoy. Footer: Crafted with ❤️ by Abhi');
})();
