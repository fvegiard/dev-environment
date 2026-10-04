// stream-chrome.js — stream an EXISTING Chrome Dev 157 into a web page with remote control.
//
// No new browser is launched. It attaches to the already-running Chrome Dev 157
// over the Chrome DevTools Protocol (CDP) on port 9222 and:
//   - streams the page image as MJPEG over HTTP (multipart/x-mixed-replace)
//   - forwards mouse/keyboard input back via the CDP Input domain
//
// References:
//   - CDP: https://chromedevtools.github.io/devtools-protocol/
//   - Page.captureScreenshot: https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot
//   - Input.dispatchMouseEvent: https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchMouseEvent
//   - Input.dispatchKeyEvent: https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchKeyEvent
//   - Input.insertText: https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-insertText
//
// Usage: node stream-chrome.js   ->  open http://127.0.0.1:8791/

const http = require('http');

const CDP_PORT = 9222;   // Chrome Dev 157 remote-debugging port
const PORT = 8791;       // this streamer's HTTP port
const FPS = 12;          // capture rate

// ---------------------------------------------------------------------------
// CDP client (uses Node's native WebSocket, no external deps)
// ---------------------------------------------------------------------------
function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

let cdp = null; // { ws, id, pending, metrics, targetUrl }

function send(state, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++state.id;
    state.pending.set(id, { resolve, reject });
    state.ws.send(JSON.stringify({ id, method, params }));
  });
}

function connectCDP() {
  return new Promise(async (resolve, reject) => {
    if (cdp && cdp.ws.readyState === 1) return resolve(cdp);
    const tabs = await getJson('/json/list');
    // Prefer a real web page target (skip chrome:// internals and iframes).
    const page =
      tabs.find((t) => t.type === 'page' && t.url && /^https?:\/\//.test(t.url)) ||
      tabs.find((t) => t.type === 'page');
    if (!page) return reject(new Error('no page target found on CDP'));
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const state = { ws, id: 0, pending: new Map(), metrics: null, targetUrl: page.url };
    ws.onopen = async () => {
      try {
        await send(state, 'Page.enable', {});
        const lm = await send(state, 'Page.getLayoutMetrics', {});
        state.metrics = (lm && lm.cssVisualViewport) || { clientWidth: 1280, clientHeight: 720, scale: 1 };
        cdp = state;
        resolve(state);
      } catch (e) { reject(e); }
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && state.pending.has(m.id)) {
        const p = state.pending.get(m.id);
        state.pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      }
    };
    ws.onerror = () => reject(new Error('CDP websocket error'));
    ws.onclose = () => { cdp = null; };
  });
}

async function captureFrame(state) {
  const r = await send(state, 'Page.captureScreenshot', {
    format: 'jpeg',
    quality: 70,
    fromSurface: true,          // capture the real rendered surface (GPU/WebGPU/AI content)
    captureBeyondViewport: false,
  });
  return Buffer.from(r.data, 'base64');
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/') return serveHtml(res);
  if (url === '/stream') return handleStream(req, res);
  if (url === '/metrics') return handleMetrics(res);
  if (url === '/input') return handleInput(req, res);
  if (url === '/eval') return handleEval(req, res);
  res.writeHead(404);
  res.end('not found');
});

function serveHtml(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
}

function handleStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Connection': 'close',
  });
  let closed = false;
  req.on('close', () => { closed = true; });

  (async () => {
    const state = await connectCDP();
    while (!closed) {
      try {
        const buf = await captureFrame(state);
        res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${buf.length}\r\n\r\n`);
        res.write(buf);
        res.write('\r\n');
      } catch (e) {
        // transient capture error (e.g. tab navigating) — keep the stream alive
      }
      await new Promise((r) => setTimeout(r, Math.round(1000 / FPS)));
    }
  })().catch(() => { if (!closed) res.end(); });
}

async function handleMetrics(res) {
  try {
    const state = await connectCDP();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...state.metrics, targetUrl: state.targetUrl }));
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}

function handleInput(req, res) {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    try {
      const ev = JSON.parse(body);
      const state = await connectCDP();
      const m = state.metrics;
      const x = (ev.x || 0) * m.clientWidth;
      const y = (ev.y || 0) * m.clientHeight;

      if (ev.type === 'move' || ev.type === 'down' || ev.type === 'up') {
        const button = ev.button === 'right' ? 'right' : ev.button === 'middle' ? 'middle' : 'left';
        const buttons = ev.type === 'up' ? 0 : (button === 'right' ? 2 : button === 'middle' ? 4 : 1);
        await send(state, 'Input.dispatchMouseEvent', {
          type: ev.type === 'down' ? 'mousePressed' : ev.type === 'up' ? 'mouseReleased' : 'mouseMoved',
          x, y, button, buttons,
          clickCount: ev.type === 'down' ? 1 : 0,
        });
      } else if (ev.type === 'wheel') {
        await send(state, 'Input.dispatchMouseEvent', {
          type: 'mouseWheel', x, y,
          deltaX: ev.deltaX || 0, deltaY: ev.deltaY || 0,
        });
      } else if (ev.type === 'text') {
        await send(state, 'Input.insertText', { text: ev.text });
      } else if (ev.type === 'key') {
        await send(state, 'Input.dispatchKeyEvent', {
          type: 'keyDown', key: ev.key, code: ev.code || ev.key, windowsVirtualKeyCode: ev.vk || 0,
        });
        await send(state, 'Input.dispatchKeyEvent', {
          type: 'keyUp', key: ev.key, code: ev.code || ev.key, windowsVirtualKeyCode: ev.vk || 0,
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

// DOM control: run arbitrary JS in the streamed page via CDP Runtime.evaluate.
function handleEval(req, res) {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    try {
      const { expression } = JSON.parse(body);
      const state = await connectCDP();
      const r = await send(state, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        value: r.result && r.result.value,
        type: r.result && r.result.type,
        description: r.result && r.result.description,
        exception: r.exceptionDetails ? r.exceptionDetails.text : null,
      }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

// ---------------------------------------------------------------------------
// Client page
// ---------------------------------------------------------------------------
const HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Chrome Dev 157 — Remote Control</title>
<style>
  html,body{margin:0;background:#0b0b0f;height:100%;overflow:hidden;font-family:system-ui}
  #bar{position:fixed;top:0;left:0;right:0;height:28px;background:#16161d;color:#9aa;font-size:12px;
       display:flex;align-items:center;padding:0 10px;gap:10px;z-index:10}
  #bar .dot{width:8px;height:8px;border-radius:50%;background:#2ecc71}
  #screen{display:block;margin:28px auto 0;max-width:100vw;max-height:calc(100vh - 28px);cursor:crosshair}
</style>
</head>
<body>
<div id="bar"><span class="dot"></span><span id="url">connecting…</span></div>
<img id="screen" src="/stream" alt="Chrome Dev 157 stream">
<script>
const img = document.getElementById('screen');
const urlEl = document.getElementById('url');

fetch('/metrics').then(r=>r.json()).then(m=>{
  if(m.targetUrl) urlEl.textContent = m.targetUrl;
});

function norm(e){
  const r = img.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
}
function post(ev){
  fetch('/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ev)}).catch(()=>{});
}

img.addEventListener('mousemove', e=>post({type:'move', ...norm(e)}));
img.addEventListener('mousedown', e=>post({type:'down', ...norm(e), button: e.button===2?'right':e.button===1?'middle':'left'}));
img.addEventListener('mouseup',   e=>post({type:'up',   ...norm(e), button: e.button===2?'right':e.button===1?'middle':'left'}));
img.addEventListener('contextmenu', e=>e.preventDefault());
img.addEventListener('wheel', e=>{ e.preventDefault(); post({type:'wheel', ...norm(e), deltaX:e.deltaX, deltaY:e.deltaY}); });

const KEYMAP = { Enter:13, Backspace:8, Tab:9, Escape:27, ArrowUp:38, ArrowDown:40, ArrowLeft:37, ArrowRight:39,
                 Delete:46, Home:36, End:35, PageUp:33, PageDown:34, ' ':32 };
window.addEventListener('keydown', e=>{
  if(e.ctrlKey || e.metaKey || e.altKey) return; // let browser shortcuts pass through
  if(e.key.length === 1){
    post({type:'text', text:e.key});
  } else if(KEYMAP[e.key] !== undefined){
    post({type:'key', key:e.key, code:e.code, vk:KEYMAP[e.key]});
    e.preventDefault();
  }
});
</script>
</body>
</html>`;

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Chrome Dev 157 streamer running at http://127.0.0.1:${PORT}/`);
  console.log(`Attaching to existing Chrome Dev 157 on CDP port ${CDP_PORT} (no new browser).`);
});
