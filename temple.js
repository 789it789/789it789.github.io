const NIST_BASE = 'https://beacon.nist.gov/beacon/2.0';
const POLL_MS = 2000;

let WORDLIST = [
  "EPENEX"
];

let state = { lastPulseIndex: null, latestPulse: null, timer: null };

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function fmtTime(ts) {
  try { return new Date(ts).toLocaleString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false}); }
  catch { return String(ts); }
}

function seedFromHex(hex) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < hex.length; i++) h = Math.imul(h ^ hex.charCodeAt(i), 16777619) >>> 0;
  return (function() {
    let s = h;
    return function() {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  })();
}

async function fetchLastPulse() {
  const res = await fetch(`${NIST_BASE}/pulse/last`, {cache: 'no-store'});
  if (!res.ok) throw new Error(`NIST fetch failed ${res.status}`);
  return res.json();
}

function makeTongues(outputHex, count = 8) {
  const rnd = seedFromHex(outputHex || Date.now().toString());
  const words = [];
  for (let i = 0; i < count; i++) words.push(WORDLIST[Math.floor(rnd() * WORDLIST.length)]);
  return words;
}

async function loadWordlist(urls = ['words.txt']) {
  for (const url of urls) {
    try {
      const res = await fetch(url, {cache: 'no-store'});
      if (!res.ok) continue;
      const ct = (res.headers.get('content-type')||'').toLowerCase();
      if (ct.includes('application/json')) {
        const arr = await res.json();
        if (Array.isArray(arr) && arr.length) { WORDLIST = arr.map(String); console.log('Loaded wordlist from', url, WORDLIST.length); return; }
      } else {
        const text = await res.text();
        const items = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (items.length) { WORDLIST = items; console.log('Loaded wordlist from', url, WORDLIST.length); return; }
      }
    } catch (err) {
      // try next url
    }
  }
  console.warn('Using fallback wordlist (external load failed or not provided).');
}

function buildUI(root) {
  root.innerHTML = '';

  const oracle = el('div', 'oracle-content');
  oracle.id = 'oracle-content';
  root.appendChild(oracle);

  const tonguesSection = el('div', 'oracle-section');

  const tonguesWrap = el('div', 'tongues-words');
  tonguesWrap.id = 'tongues-words';
  tonguesSection.appendChild(tonguesWrap);

  let meta = document.getElementById('meta-window');
  if (meta) meta.remove();

  meta = el('div', 'tos-window');
  meta.id = 'meta-window';
  meta.style.display = 'none';
  meta.innerHTML = `
    <div class="tos-titlebar">
      <span class="tos-title" id="meta-title">Pulse Details</span>
      <button class="tos-close" id="meta-close" type="button">×</button>
    </div>
    <div class="tos-window-body" id="meta-body"></div>
  `;

  tonguesSection.appendChild(meta);
  oracle.appendChild(tonguesSection);

  const controlSection = el('div', 'oracle-section');
  const btn = el('button', '', 'Show Pulse Details');
  btn.type = 'button';
  btn.style.marginTop = '8px';
  btn.onclick = () => toggleMetaWindow();
  controlSection.appendChild(btn);
  oracle.appendChild(controlSection);

  document.getElementById('meta-close').onclick = () => {
    meta.style.display = 'none';
  };
}

function updateUIForPulse(pulse) {
  const idx = pulse.pulseIndex;
  const ts = pulse.timeStamp;
  const out = pulse.outputValue || pulse.localRandomValue || '';
  const statusText = document.getElementById('pulse-status-text');
  const liveDot = document.getElementById('live-dot');

  // tongues
  const tongues = makeTongues(out, 10);
  const wrap = document.getElementById('tongues-words');
  wrap.innerHTML = '';
  tongues.forEach((w,i) => {
    const s = el('span','tongue-word', w);
    s.style.animationDelay = `${i * 0.06}s`;
    wrap.appendChild(s);
  });

  // populate meta body
  const metaBody = document.getElementById('meta-body');
  if (metaBody) {
    metaBody.innerHTML = `
    <div class="meta-row"><strong>Pulse Index:</strong> ${idx}</div>
    <div class="meta-row"><strong>Timestamp:</strong> ${ts}</div>
    <div class="meta-row"><strong>Period (ms):</strong> ${pulse.period}</div>
    <div class="meta-row"><strong>Chain Index:</strong> ${pulse.chainIndex}</div>
    <div class="meta-row"><strong>Cipher Suite:</strong> ${pulse.cipherSuite}</div>
    <div style="height:8px"></div>
    <div><span class="meta-label">Output (hex):</span><div class="hex" style="margin-top:6px">${out || '—'}</div></div>
    `;
  }
}

function toggleMetaWindow() {
  const w = document.getElementById('meta-window');
  if (!w) return;
  w.style.display = (w.style.display === 'none' || w.style.display === '') ? 'block' : 'none';
}

function startPolling() {
  if (state.timer) return;
  async function tick() {
    try {
      const json = await fetchLastPulse();
      if (!json || !json.pulse) throw new Error('invalid nist response');
      const pulse = json.pulse;
      if (state.lastPulseIndex !== pulse.pulseIndex) {
        state.lastPulseIndex = pulse.pulseIndex;
        state.latestPulse = pulse;
        updateUIForPulse(pulse);
      }
      const period = pulse.period || 60000;
      const now = Date.now();
      const ts = Date.parse(pulse.timeStamp) || now;
      const elapsed = now - ts;
      const remaining = Math.max(0, Math.round((period - elapsed) / 1000));
      const countdownEl = document.getElementById('countdown');
      const labelEl = document.getElementById('countdown-label');
      if (countdownEl) {
        if (remaining <= 0) { countdownEl.textContent = '...'; labelEl.textContent = 'Waiting for Next Beacon'; }
        else { countdownEl.textContent = `${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`; labelEl.textContent = 'Next Pulse'; }
        if (remaining <= 5) countdownEl.classList.add('urgent'); else countdownEl.classList.remove('urgent');
      }
    } catch (err) {
      const statusText = document.getElementById('pulse-status-text');
      if (statusText) statusText.textContent = 'Error fetching NIST pulse: ' + (err.message || String(err));
    } finally {
      state.timer = setTimeout(tick, POLL_MS);
    }
  }
  tick();
}

(async function init() {
  let root = document.getElementById('app');
  if (!root) {
    root = document.createElement('div');
    root.id = 'app';
    document.body.prepend(root);
  }
  await loadWordlist(['words.txt']);
  buildUI(root);
  startPolling();
})();
