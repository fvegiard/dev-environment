// stream-window.js — stream the FULL Chrome Dev 157 window (chrome UI + content)
// into a web page with OS-level remote control.
//
// Unlike stream-chrome.js (which captures only the page viewport via CDP), this
// captures the ENTIRE browser window — tabs, address bar, toolbar, and page —
// using ffmpeg gdigrab. Mouse/keyboard are forwarded at the OS level via
// SendInput (input-helper.ps1), so clicking tabs/address bar works too.
// CDP Runtime.evaluate is kept for DOM control (/eval).
//
// Usage: node stream-window.js   ->  open http://127.0.0.1:8792/

const http = require('http');
const { spawn, execFile } = require('child_process');

const PORT = 8792;
const FPS = 15;
const SCALE_WIDTH = 1280;                 // downscale width for streaming
const WINDOW_TITLE = 'Mavis — Full Environment Map - Google Chrome';
const CDP_PORT = 9222;                    // for /eval DOM control

let win = { left: 0, top: 0, width: 1936, height: 2304 }; // filled at startup
let latestFrame = null;
const clients = new Set();

// ---------------------------------------------------------------------------
// Window bounds detection (PowerShell GetWindowRect by title)
// ---------------------------------------------------------------------------
function getWindowBounds() {
  return new Promise((resolve) => {
    const ps = `
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
[StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; } }
"@
[W]::SetProcessDPIAware() | Out-Null
$p = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*Mavis*' } | Select-Object -First 1
if (-not $p) { Write-Output '{}'; exit }
$r = New-Object W+RECT
[W]::GetWindowRect($p.MainWindowHandle, [ref]$r) | Out-Null
Write-Output ('{"left":' + $r.L + ',"top":' + $r.T + ',"width":' + ($r.R-$r.L) + ',"height":' + ($r.B-$r.T) + '}')
`;
    execFile('powershell', ['-NoProfile', '-Command', ps], { timeout: 8000 }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        const b = JSON.parse(stdout.trim());
        if (b.width && b.height) resolve(b);
        else resolve(null);
      } catch { resolve(null); }
    });
  });
}

// ---------------------------------------------------------------------------
// ffmpeg gdigrab -> MJPEG frames on stdout
// ---------------------------------------------------------------------------
function startCapture() {
  const args = [
    '-f', 'gdigrab', '-framerate', String(FPS),
    '-offset_x', String(Math.max(0, win.left)),
    '-offset_y', String(Math.max(0, win.top)),
    '-video_size', `${win.width}x${win.height}`,
    '-i', 'desktop',
    '-vf', `scale=${SCALE_WIDTH}:-1`,
    '-f', 'mjpeg', '-q:v', '6',
    'pipe:1',
  ];
  const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'ignore'] });
  let buf = Buffer.alloc(0);
  const SOI = Buffer.from([0xff, 0xd8]);
  const EOI = Buffer.from([0xff, 0xd9]);
  ff.stdout.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    let start, end;
    while ((start = buf.indexOf(SOI)) !== -1) {
      end = buf.indexOf(EOI, start + 2);
      if (end === -1) break;
      const frame = buf.slice(start, end + 2);
      buf = buf.slice(end + 2);
      latestFrame = frame;
      for (const c of clients) c.write(frame);
    }
  });
  ff.on('error', (e) => console.error('ffmpeg error:', e.message));
  ff.on('exit', (code) => console.error('ffmpeg exited:', code));
  return ff;
}

// ---------------------------------------------------------------------------
// CDP client (for /eval DOM control only)
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
let cdp = null;
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
    const page = tabs.find((t) => t.type === 'page' && t.url && /^https?:\/\//.test(t.url)) || tabs.find((t) => t.type === 'page');
    if (!page) return reject(new Error('no page target'));
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const state = { ws, id: 0, pending: new Map(), targetUrl: page.url };
    ws.onopen = async () => {
      try { await send(state, 'Runtime.enable', {}); cdp = state; resolve(state); }
      catch (e) { reject(e); }
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && state.pending.has(m.id)) {
        const p = state.pending.get(m.id);
        state.pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      }
    };
    ws.onerror = () => reject(new Error('CDP ws error'));
    ws.onclose = () => { cdp = null; };
  });
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
  res.writeHead(404); res.end('not found');
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
  const client = { res, write: (frame) => {
    res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
    res.write(frame);
    res.write('\r\n');
  }};
  clients.add(client);
  if (latestFrame) client.write(latestFrame);
  req.on('close', () => clients.delete(client));
}

function handleMetrics(res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ...win, fps: FPS, scaleWidth: SCALE_WIDTH, targetUrl: cdp ? cdp.targetUrl : null }));
}

// OS-level input: map normalized (0-1) coords to absolute screen coords, forward to helper.
function handleInput(req, res) {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try {
      const ev = JSON.parse(body);
      const cmd = {};
      if (ev.type === 'move' || ev.type === 'down' || ev.type === 'up') {
        cmd.type = ev.type === 'move' ? 'move' : 'click';
        if (ev.type === 'move') {
          cmd.x = Math.round(win.left + (ev.x || 0) * win.width);
          cmd.y = Math.round(win.top + (ev.y || 0) * win.height);
        } else {
          cmd.button = ev.button === 'right' ? 'right' : ev.button === 'middle' ? 'middle' : 'left';
          cmd.down = ev.type === 'down';
        }
      } else if (ev.type === 'wheel') {
        cmd.type = 'wheel';
        cmd.delta = Math.round(ev.deltaY || 0);
      } else if (ev.type === 'text') {
        cmd.type = 'text';
        cmd.text = ev.text;
      } else if (ev.type === 'key') {
        cmd.type = 'key';
        cmd.vk = ev.vk || 0;
        cmd.up = ev.up === true;
      }
      if (helper && helper.stdin.writable) helper.stdin.write(JSON.stringify(cmd) + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

function handleEval(req, res) {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    try {
      const { expression } = JSON.parse(body);
      const state = await connectCDP();
      const r = await send(state, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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
<title>Chrome Dev 157 — Full Window</title>
<style>
  html,body{margin:0;background:#0b0b0f;height:100%;overflow:hidden;font-family:system-ui}
  #bar{position:fixed;top:0;left:0;right:0;height:28px;background:#16161d;color:#9aa;font-size:12px;
       display:flex;align-items:center;padding:0 10px;gap:10px;z-index:10}
  #bar .dot{width:8px;height:8px;border-radius:50%;background:#2ecc71}
  #screen{display:block;margin:28px auto 0;max-width:100vw;max-height:calc(100vh - 28px);cursor:crosshair}
</style>
</head>
<body>
<div id="bar"><span class="dot"></span><span id="status">full window — connecting…</span></div>
<img id="screen" src="/stream" alt="Chrome Dev 157 full window">
<script>
const img = document.getElementById('screen');
const statusEl = document.getElementById('status');
fetch('/metrics').then(r=>r.json()).then(m=>{
  statusEl.textContent = 'full window ' + m.width + '×' + m.height + (m.targetUrl ? ' — ' + m.targetUrl : '');
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
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(e.key.length === 1){ post({type:'text', text:e.key}); }
  else if(KEYMAP[e.key] !== undefined){ post({type:'key', vk:KEYMAP[e.key], up:false}); post({type:'key', vk:KEYMAP[e.key], up:true}); e.preventDefault(); }
});
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
let helper = null;
(async () => {
  const b = await getWindowBounds();
  if (b) win = b;
  console.log(`Window bounds: ${win.left},${win.top} ${win.width}x${win.height}`);

  helper = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', __dirname + '\\input-helper.ps1'], { stdio: ['pipe', 'pipe', 'ignore'] });
  helper.stdout.on('data', () => {}); // drain
  helper.on('error', (e) => console.error('helper error:', e.message));

  startCapture();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Full-window streamer running at http://127.0.0.1:${PORT}/`);
    console.log(`Capturing entire Chrome Dev 157 window (${win.width}x${win.height}) via gdigrab.`);
  });
})();
