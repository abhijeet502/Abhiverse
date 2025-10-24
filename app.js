// Boot Animation
window.addEventListener("load", () => {
  const boot = document.getElementById("boot-screen");
  setTimeout(() => {
    boot.style.opacity = "0";
    setTimeout(() => boot.remove(), 1000);
  }, 3500);
});

// Clock
function updateTime() {
  const time = new Date().toLocaleTimeString();
  document.getElementById("time").textContent = time;
}
setInterval(updateTime, 1000);
updateTime();

// News Headlines (RSS feed — no API key)
async function loadNews() {
  const proxy = "https://api.allorigins.win/get?url=";
  const url = encodeURIComponent("https://feeds.arstechnica.com/arstechnica/index");
  const res = await fetch(proxy + url);
  const data = await res.json();
  const parser = new DOMParser();
  const xml = parser.parseFromString(data.contents, "text/xml");
  const items = xml.querySelectorAll("item");
  const list = document.getElementById("news");
  list.innerHTML = "";
  items.forEach((item, i) => {
    if (i < 6) {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${item.querySelector("link").textContent}" target="_blank">${item.querySelector("title").textContent}</a>`;
      list.appendChild(li);
    }
  });
}
loadNews();

// Map (Leaflet)
const map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 4,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Animated glowing particles
const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d");
canvas.style.position = "fixed";
canvas.style.top = 0;
canvas.style.left = 0;
canvas.style.zIndex = 1;
canvas.width = innerWidth;
canvas.height = innerHeight;

const orbs = Array.from({ length: 40 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 3 + 1,
  dx: (Math.random() - 0.5) * 0.6,
  dy: (Math.random() - 0.5) * 0.6
}));

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  orbs.forEach(o => {
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,255,255,${Math.random() * 0.7})`;
    ctx.fill();
    o.x += o.dx;
    o.y += o.dy;
    if (o.x < 0 || o.x > canvas.width) o.dx *= -1;
    if (o.y < 0 || o.y > canvas.height) o.dy *= -1;
  });
  requestAnimationFrame(animate);
}
animate();
