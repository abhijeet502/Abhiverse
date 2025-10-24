// Boot logic
window.addEventListener('load', () => {
  const boot = document.querySelector('#boot');
  boot.classList.add('fade-out');
  setTimeout(() => {
    boot.style.display = 'none';
    document.querySelector('#app').style.display = 'block';
    initApp();
  }, 2000);
});

// Simulated data feed
const feedLines = [
  "[INFO] Connecting to Aurora Core...",
  "[DATA] Fetching global metrics...",
  "[SYNC] Timezones aligned successfully.",
  "[STREAM] Loading latest tech trends...",
  "[SERVER] AbhiCloud-Node active.",
  "[STATUS] Systems operational ✅",
  "[UPDATE] No billing required 💸",
  "[AI] Generating future predictions...",
  "[INFO] Mission status: Green 🌍"
];

function initApp() {
  const feed = document.getElementById('feed');
  let index = 0;
  const interval = setInterval(() => {
    if (index < feedLines.length) {
      const line = document.createElement('div');
      line.textContent = feedLines[index];
      feed.appendChild(line);
      feed.scrollTop = feed.scrollHeight;
      index++;
    } else {
      clearInterval(interval);
    }
  }, 900);
  startAurora();
}

// Aurora canvas background
function startAurora() {
  const canvas = document.getElementById("aurora");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.2,
      color: `hsla(${Math.random() * 60 + 180}, 90%, 65%, 0.25)`
    });
  }

  function animate() {
    ctx.fillStyle = "rgba(15,23,42,0.2)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      p.y -= 0.3;
      p.x += Math.sin(p.y / 40) * 0.6;
      if (p.y < -5) p.y = canvas.height + 5;
    }
    requestAnimationFrame(animate);
  }
  animate();
}
