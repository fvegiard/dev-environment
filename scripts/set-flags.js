// Set Chrome flags via the chrome://flags page (CDP).
const http = require('http');

const TARGETS = [
  ['prompt-api-tool-use', 'Enabled'],
  ['prompt-api-sampling-mode', 'Enabled'],
  ['summarizer-api', 'Enabled Multilingual'],
  ['enable-unsafe-webgpu', 'enabled'],
  ['experimental-web-machine-learning-neural-network', 'Enabled'],
  ['webnn-onnxruntime', 'Enabled'],
  ['enable-experimental-webassembly-features', 'enabled'],
  ['enable-experimental-webassembly-shared-everything', 'Enabled'],
  ['enable-experimental-webassembly-stack-switching', 'Enabled'],
  ['enable-webassembly-baseline', 'Enabled'],
  ['enable-webassembly-lazy-compilation', 'Enabled'],
  ['enable-webassembly-tiering', 'Enabled'],
];

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 9222, path }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

(async () => {
  const tabs = await getJson('/json/list');
  const flags = tabs.find((t) => t.url && t.url.startsWith('chrome://flags'));
  if (!flags) { console.error('no flags tab'); process.exit(1); }
  const ws = new WebSocket(flags.webSocketDebuggerUrl);

  const expr = `(() => {
    const TARGETS = ${JSON.stringify(TARGETS)};
    const app = document.querySelector('flags-app');
    const exps = app.shadowRoot.querySelectorAll('flags-experiment');
    const map = {};
    for (const e of exps) map[e.id] = e;
    const results = [];
    for (const [id, val] of TARGETS) {
      const e = map[id];
      if (!e) { results.push({ id, ok: false, err: 'not found' }); continue; }
      const sel = e.shadowRoot.querySelector('select');
      if (!sel) { results.push({ id, ok: false, err: 'no select' }); continue; }
      if (sel.value === val) { results.push({ id, ok: true, skipped: true, val: sel.value }); continue; }
      sel.value = val;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      results.push({ id, ok: true, set: true, val: sel.value });
    }
    return JSON.stringify(results);
  })()`;

  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id === 1) {
      console.log(m.result && m.result.result ? m.result.result.value : JSON.stringify(m));
      process.exit(0);
    }
  };
  ws.onerror = (e) => { console.error('ERR', e.message); process.exit(1); };
})();
