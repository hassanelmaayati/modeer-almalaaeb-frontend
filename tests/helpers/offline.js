import { test as base, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
const origin = 'http://127.0.0.1:5174';
const apiOrigin = 'http://127.0.0.1:8001';
const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const googleStub = 'window.google={accounts:{id:{initialize:function(v){this.options=v},renderButton:function(el){var b=document.createElement("button");b.textContent="Offline Google sign-in";b.onclick=()=>this.options.callback({credential:"offline-test-credential"});el.appendChild(b)},cancel:function(){},disableAutoSelect:function(){}}}};';
function localUrl(value, socket = false) {
  const url = new URL(value);
  return (socket ? ['ws:', 'wss:'] : ['http:', 'https:']).includes(url.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && ['5174', '8001'].includes(url.port);
}
async function guard(context, problems) {
  context.on('page', page => page.on('pageerror', error => problems.push(`Browser error: ${error.message}`)));
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: tile });
    if (url === 'https://accounts.google.com/gsi/client') return route.fulfill({ status: 200, contentType: 'application/javascript', body: googleStub });
    if (localUrl(url)) return route.continue();
    problems.push(`Unexpected outbound HTTP request: ${url}`);
    await route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => {
    if (localUrl(socket.url(), true)) { socket.connectToServer(); return; }
    problems.push(`Unexpected outbound WebSocket: ${socket.url()}`);
    socket.close({ code: 1008, reason: 'Offline test blocked external socket' });
  });
}
export const test = base.extend({
  _offlineProblems: [async ({ request }, provide) => {
    const response = await request.post(`${apiOrigin}/__test__/reset`);
    expect(response.status(), 'Disposable fixture reset must succeed').toBe(200);
    const problems = [];
    await provide(problems);
    expect(problems, 'Offline/browser errors').toEqual([]);
  }, { auto: true }],
  context: async ({ context, _offlineProblems }, provide) => { await guard(context, _offlineProblems); await provide(context); },
  offlineContext: async ({ browser, _offlineProblems }, provide) => {
    const contexts = [];
    await provide(async (options = {}) => {
      const context = await browser.newContext({ baseURL: origin, serviceWorkers: 'block', ...options });
      await guard(context, _offlineProblems);
      contexts.push(context);
      return context;
    });
    await Promise.all(contexts.map(context => context.close()));
  },
});
export { expect };
