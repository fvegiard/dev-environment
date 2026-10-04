// CDP helper: evaluate JS on a Chrome Dev tab and print the result.
// Usage: node cdp-eval.js <expression>
const expr = process.argv[2];
const http = require('http');

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
  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id === 1) {
      if (m.result && m.result.result) console.log(m.result.result.value);
      else console.log(JSON.stringify(m));
      process.exit(0);
    }
  };
  ws.onerror = (e) => { console.error('ERR', e.message); process.exit(1); };
})();
