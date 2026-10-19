// ---------- Smart Ride: shared frontend helpers ----------
const API_BASE = '/api';

function getToken() { return localStorage.getItem('sr_token'); }
function getAccount() {
  const raw = localStorage.getItem('sr_account');
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch (_) { localStorage.removeItem('sr_account'); return null; }
}
function setSession(token, account) {
  localStorage.setItem('sr_token', token);
  localStorage.setItem('sr_account', JSON.stringify(account));
}
function clearSession() {
  localStorage.removeItem('sr_token');
  localStorage.removeItem('sr_account');
}
function logout() {
  clearSession();
  window.location.href = 'login.html';
}

async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (_) {
    throw new Error('Cannot reach Smart Ride server. Check that the backend is running and your internet connection is available.');
  }
  let data;
  try { data = await res.json(); } catch (e) { data = { success: false, message: 'Invalid server response.' }; }

  if (res.status === 401 && auth) {
    clearSession();
    window.location.href = 'login.html';
    throw new Error('Session expired');
  }
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Something went wrong. Please try again.');
  }
  return data;
}

function showAlert(elId, message, type = 'error') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.classList.remove('hidden');
}
function hideAlert(elId) {
  const el = document.getElementById(elId);
  if (el) el.classList.add('hidden');
}

function fmtMoney(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function statusBadge(status) {
  const map = {
    active: 'badge-success', pending_payment: 'badge-warning', cancelled: 'badge-danger',
    completed: 'badge-info', open: 'badge-warning', resolved: 'badge-success',
    success: 'badge-success', missed: 'badge-danger', rescheduled: 'badge-warning',
    verified: 'badge-success', pending_verification: 'badge-warning', rejected: 'badge-danger',
  };
  const cls = map[status] || 'badge-muted';
  const label = String(status).replace(/_/g, ' ');
  return `<span class="badge ${cls}">${label}</span>`;
}

function requireRole(expectedRole) {
  const token = getToken();
  const account = getAccount();
  if (!token || !account || account.role !== expectedRole) {
    window.location.href = 'login.html';
    return null;
  }
  return account;
}

function renderNavbar(activeAccount) {
  const el = document.getElementById('navbar');
  if (!el) return;
  const dash = activeAccount
    ? (activeAccount.role === 'user' ? 'user-dashboard.html' : activeAccount.role === 'driver' ? 'driver-dashboard.html' : 'admin-dashboard.html')
    : null;

  el.innerHTML = `
    <a class="brand" href="${dash || 'index.html'}"><span class="brand-mark"></span>Smart Ride</a>
    <div class="nav-right">
      <div class="sr-clock" id="srLiveClock" aria-live="off">
        <span class="sr-clock-day">Loading date…</span>
        <strong class="sr-clock-time">--:--:--</strong>
      </div>
      <nav>
        ${activeAccount
          ? `<span class="hello">${String(activeAccount.name || 'User').split(' ')[0]} · ${activeAccount.role}</span>
             <button onclick="logout()">Logout</button>`
          : `<a href="index.html">Home</a><a href="index.html#how-it-works">How It Works</a><a href="index.html#plans">Pricing</a><a href="login.html">Login</a><a class="nav-register" href="register.html">Register</a>`
        }
      </nav>
    </div>
  `;
  startSmartRideClock();
}

function startSmartRideClock() {
  const update = () => {
    const el = document.getElementById('srLiveClock');
    if (!el) return;
    const now = new Date();
    const day = el.querySelector('.sr-clock-day');
    const time = el.querySelector('.sr-clock-time');
    if (day) day.textContent = now.toLocaleDateString('en-IN', {
      weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
    });
    if (time) time.textContent = now.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  };
  update();
  if (window._smartRideClockTimer) clearInterval(window._smartRideClockTimer);
  window._smartRideClockTimer = setInterval(update, 1000);
}


// ---------- Shared route-map modal (Leaflet, no API key needed) ----------
let _routeMapInstance = null;

function ensureRouteMapModal() {
  if (document.getElementById('routeMapModal')) return;
  const div = document.createElement('div');
  div.id = 'routeMapModal';
  div.className = 'modal-overlay hidden';
  div.innerHTML = `
    <div class="modal-box">
      <button class="modal-close" onclick="closeRouteMap()">✕</button>
      <h3 style="margin-top:0;">Route</h3>
      <div id="routeMapLegend" style="margin-bottom:10px;font-size:0.88rem;color:var(--muted);"></div>
      <div id="routeMapContainer" class="map-box-lg"></div>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener('click', (e) => { if (e.target === div) closeRouteMap(); });
}

function openRouteMap(pLat, pLng, dLat, dLng, pLabel, dLabel) {
  ensureRouteMapModal();
  document.getElementById('routeMapModal').classList.remove('hidden');
  document.getElementById('routeMapLegend').innerHTML = `<b>Pickup:</b> ${pLabel || '—'} &nbsp;→&nbsp; <b>Drop:</b> ${dLabel || '—'}`;

  const container = document.getElementById('routeMapContainer');
  if (_routeMapInstance) { _routeMapInstance.remove(); _routeMapInstance = null; }
  container.innerHTML = '';

  if (pLat == null || pLng == null || dLat == null || dLng == null || !window.L) {
    container.innerHTML = '<div class="empty-state">No map coordinates were saved for this route.</div>';
    return;
  }

  setTimeout(() => {
    _routeMapInstance = L.map('routeMapContainer').setView([(pLat + dLat) / 2, (pLng + dLng) / 2], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(_routeMapInstance);

    const pickupIcon = L.divIcon({ className: 'leaflet-pin-pickup', iconSize: [16, 16] });
    const dropIcon = L.divIcon({ className: 'leaflet-pin-drop', iconSize: [16, 16] });

    L.marker([pLat, pLng], { icon: pickupIcon }).addTo(_routeMapInstance).bindPopup('Pickup: ' + (pLabel || ''));
    L.marker([dLat, dLng], { icon: dropIcon }).addTo(_routeMapInstance).bindPopup('Drop: ' + (dLabel || ''));
    L.polyline([[pLat, pLng], [dLat, dLng]], { color: '#1d7874', dashArray: '6,8', weight: 3 }).addTo(_routeMapInstance);
    _routeMapInstance.fitBounds([[pLat, pLng], [dLat, dLng]], { padding: [36, 36] });
  }, 30);
}

function closeRouteMap() {
  const el = document.getElementById('routeMapModal');
  if (el) el.classList.add('hidden');
}

// ---------- Trip status timeline ----------
const TRIP_FLOW = [
  { key: 'on_the_way', label: 'On the way' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'picked_up', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

function tripFlowHtml(currentStatus) {
  if (currentStatus === 'missed') {
    return `<div class="trip-flow"><span class="trip-step missed">Missed today</span></div>`;
  }
  const currentIndex = TRIP_FLOW.findIndex(s => s.key === currentStatus);
  return `<div class="trip-flow">${TRIP_FLOW.map((s, i) => {
    let cls = 'trip-step';
    if (currentIndex === -1) cls += '';
    else if (i < currentIndex) cls += ' done';
    else if (i === currentIndex) cls += ' current';
    return `<span class="${cls}">${s.label}</span>`;
  }).join('')}</div>`;
}

// ---------- Star rating widget ----------
function starDisplay(stars) {
  if (!stars) return '<span style="color:var(--muted);font-size:0.82rem;">Not rated yet</span>';
  return `<span class="star-display">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span>`;
}

function starPickerHtml(name, current) {
  current = current || 0;
  let html = `<div class="star-row" id="starRow-${name}">`;
  for (let i = 1; i <= 5; i++) {
    html += `<button type="button" class="star-btn ${i <= current ? 'filled' : ''}" data-value="${i}" onclick="setStarValue('${name}', ${i})">★</button>`;
  }
  html += `</div><input type="hidden" id="starValue-${name}" value="${current}" />`;
  return html;
}

function setStarValue(name, value) {
  document.getElementById('starValue-' + name).value = value;
  document.querySelectorAll(`#starRow-${name} .star-btn`).forEach(btn => {
    btn.classList.toggle('filled', Number(btn.dataset.value) <= value);
  });
}

// ---------- Shared chat modal (polling-based "live" chat) ----------
let _chatPollTimer = null;
let _chatSubscriptionId = null;
let _chatApiBase = '/chat';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function ensureChatModal() {
  if (document.getElementById('chatModal')) return;
  const div = document.createElement('div');
  div.id = 'chatModal';
  div.className = 'modal-overlay hidden';
  div.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <button class="modal-close" onclick="closeChatModal()">✕</button>
      <h3 style="margin-top:0;" id="chatModalTitle">Chat</h3>
      <div id="chatMessages" class="chat-messages"></div>
      <div id="chatInputRow">
        <input type="text" id="chatInput" maxlength="1000" placeholder="Type a message…" />
        <button class="btn btn-primary" id="chatSendBtn" onclick="sendChatMessage()">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener('click', (e) => { if (e.target === div) closeChatModal(); });
  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
}

async function openChatModal(subscriptionId, otherPartyName, readOnly, apiBase) {
  ensureChatModal();
  _chatSubscriptionId = subscriptionId;
  _chatApiBase = apiBase || '/chat';

  document.getElementById('chatModal').classList.remove('hidden');
  document.getElementById('chatModalTitle').textContent = 'Chat with ' + (otherPartyName || '');
  document.getElementById('chatInputRow').style.display = readOnly ? 'none' : 'flex';

  await loadChatMessages();
  if (_chatPollTimer) clearInterval(_chatPollTimer);
  _chatPollTimer = setInterval(loadChatMessages, 4000);
}

function closeChatModal() {
  const el = document.getElementById('chatModal');
  if (el) el.classList.add('hidden');
  if (_chatPollTimer) { clearInterval(_chatPollTimer); _chatPollTimer = null; }
  _chatSubscriptionId = null;
}

async function loadChatMessages() {
  if (!_chatSubscriptionId) return;
  try {
    const data = await apiRequest(`${_chatApiBase}/${_chatSubscriptionId}`);
    const el = document.getElementById('chatMessages');
    if (!el) return;
    const wasNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    const myId = getAccount() ? getAccount().id : null;

    el.innerHTML = data.messages.length === 0
      ? '<div class="empty-state" style="padding:30px 10px;">No messages yet. Say hello!</div>'
      : data.messages.map(m => `
          <div class="chat-bubble-row ${m.senderId === myId ? 'mine' : ''}">
            <div class="chat-bubble">
              ${m.senderName ? `<div style="font-size:0.7rem;font-weight:700;opacity:0.7;margin-bottom:2px;">${m.senderName}</div>` : ''}
              ${escapeHtml(m.text)}
              <div class="chat-bubble-time">${fmtDateTime(m.createdAt)}</div>
            </div>
          </div>
        `).join('');

    if (wasNearBottom) el.scrollTop = el.scrollHeight;
  } catch (err) {
    // Fail quietly on poll errors
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !_chatSubscriptionId) return;
  input.value = '';
  try {
    await apiRequest(`${_chatApiBase}/${_chatSubscriptionId}`, { method: 'POST', body: { text } });
    loadChatMessages();
  } catch (err) {
    alert(err.message);
  }
}
