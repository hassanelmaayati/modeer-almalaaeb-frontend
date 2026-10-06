import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Stub the OS boundary in a fresh process before installing the guard. A regression
// cannot contact the internet, and these tests do not need listening ports.
function guardedChecks(checks) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import net from 'node:net';
    import dns from 'node:dns';
    import dgram from 'node:dgram';
    const calls = { tcp: [], udp: [], lookup: [] };
    net.Socket.prototype.connect = function (...args) { calls.tcp.push(args); return this; };
    dgram.Socket.prototype.connect = function (...args) { calls.udp.push(['connect', ...args]); return this; };
    dgram.Socket.prototype.send = function (...args) { calls.udp.push(['send', ...args]); return this; };
    dns.lookup = function (host, options, callback) {
      calls.lookup.push(host);
      if (typeof options === 'function') { callback = options; options = {}; }
      const family = net.isIP(host);
      callback(null, options?.all ? [{address: host, family}] : host, family);
    };
    const { isLoopback } = await import('./scripts/deny-outbound.mjs');
    ${checks}
  `], { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('accepts valid IPv4, IPv6 and mapped loopback addresses and rejects malformed/public forms', () => {
  guardedChecks(`
    for (const host of [undefined, 'localhost', 'LOCALHOST', '127.0.0.1', '127.255.255.255', '::1', '[::1]', '0:0:0:0:0:0:0:1', '::ffff:127.0.0.1', '::ffff:7f00:1']) assert.equal(isLoopback(host), true, host);
    for (const host of ['', 'localhost.example', '127.999.1.1', '127.1', '2130706433', '0.0.0.0', '8.8.8.8', '192.168.1.2', '::', '::ffff:8.8.8.8', '::2', 'https://localhost']) assert.equal(isLoopback(host), false, host);
  `);
});

test('delegates TCP port/options/normalized and Unix socket overloads without losing callbacks', () => {
  guardedChecks(`
    const socket = new net.Socket(); const callback = () => {};
    const normalized = [{ port: 8001, host: '::1' }, callback];
    for (const args of [[8001, '127.0.0.1', callback], [8001, callback], [{ port: 8001 }, callback], [normalized], ['/tmp/modeer.sock', callback], [{ path: '/tmp/modeer.sock' }, callback]]) assert.equal(socket.connect(...args), socket);
    assert.equal(calls.tcp.length, 6);
    assert.equal(calls.tcp[0][2], callback);
    assert.equal(calls.tcp[3][0], normalized);
  `);
});

test('blocks external TCP destinations before reaching the OS boundary', () => {
  guardedChecks(`
    const socket = new net.Socket();
    for (const args of [[443, 'example.com'], [{port: 443, host: '8.8.8.8'}], [[{port:443, host:'::ffff:8.8.8.8'}]]]) assert.throws(() => socket.connect(...args), /Offline test blocked/);
    assert.equal(calls.tcp.length, 0);
  `);
});

test('replaces Playwright-style custom lookups with local DNS without mutating options or callbacks', () => {
  guardedChecks(`
    const socket = new net.Socket(); let unsafeCalls=0; const callback=()=>{};
    const options={port:8001, host:'localhost', lookup:()=>{unsafeCalls++;}};
    socket.connect(options, callback);
    const received=calls.tcp[0][0]; assert.notEqual(received, options); assert.notEqual(received.lookup, options.lookup); assert.equal(calls.tcp[0][1], callback);
    received.lookup('localhost', {}, (error, address) => { assert.equal(error, null); assert.equal(address, '127.0.0.1'); });
    const normalized=[options, callback]; const mark=Symbol('normalized'); normalized[mark]=true;
    socket.connect(normalized);
    assert.equal(calls.tcp[1][0][mark], true); assert.equal(calls.tcp[1][0][1], callback); assert.notEqual(calls.tcp[1][0][0].lookup, options.lookup);
    assert.equal(normalized[0], options); assert.equal(unsafeCalls, 0);
  `);
});

test('keeps callback, promise, family and all-result DNS lookups on IP literals', () => {
  guardedChecks(`
    dns.lookup('localhost', (error, address, family) => { assert.equal(error, null); assert.equal(address, '127.0.0.1'); assert.equal(family, 4); });
    assert.deepEqual(await dns.promises.lookup('localhost', {family:6}), {address:'::1', family:6});
    assert.deepEqual(await dns.promises.lookup('127.0.0.2', {all:true}), [{address:'127.0.0.2', family:4}]);
    assert.deepEqual(calls.lookup, ['127.0.0.1', '::1', '127.0.0.2']);
  `);
});

test('blocks every callback/promise DNS resolver and fresh Resolver instances', () => {
  guardedChecks(`
    const methods = ['resolve','resolve4','resolve6','resolveAny','resolveCaa','resolveCname','resolveMx','resolveNaptr','resolveNs','resolvePtr','resolveSoa','resolveSrv','resolveTxt','reverse','lookupService'];
    assert.throws(() => dns.lookup('example.com', ()=>{}), /Offline test blocked/);
    await assert.rejects(dns.promises.lookup('example.com'), /Offline test blocked/);
    for (const method of methods) {
      for (const resolver of [dns, new dns.Resolver()]) if (typeof resolver[method] === 'function') assert.throws(() => resolver[method]('example.com', ()=>{}), /Offline test blocked/);
      for (const resolver of [dns.promises, new dns.promises.Resolver()]) if (typeof resolver[method] === 'function') await assert.rejects(resolver[method]('example.com'), /Offline test blocked/);
    }
    assert.throws(() => dns.resolve4('localhost', ()=>{}), /Offline test blocked/);
    assert.equal(calls.lookup.length, 0);
  `);
});

test('named DNS imports receive the guarded export', () => {
  guardedChecks(`
    const { lookup, resolve4 } = await import('node:dns');
    assert.throws(() => lookup('example.com', ()=>{}), /Offline test blocked/);
    assert.throws(() => resolve4('example.com', ()=>{}), /Offline test blocked/);
  `);
});

test('allows local UDP overloads while preserving payloads and callbacks', () => {
  guardedChecks(`
    const socket = dgram.createSocket('udp4'); const buffer=Buffer.from('test'); const callback=()=>{};
    socket.connect(8001, '127.0.0.1', callback);
    socket.send(buffer, 8001, '127.0.0.1', callback);
    socket.send(buffer, 0, buffer.length, 8001, '127.0.0.1', callback);
    socket.send(buffer, 8001, callback);
    socket.send(buffer, callback);
    assert.equal(calls.udp.length, 5); assert.equal(calls.udp[1][1], buffer); assert.equal(calls.udp[2].at(-1), callback);
    socket.close();
  `);
});

test('blocks UDP destinations in both send signatures, connect and multicast', () => {
  guardedChecks(`
    const socket=dgram.createSocket('udp4'); const buffer=Buffer.from('test');
    assert.throws(() => socket.connect(53, '8.8.8.8'), /Offline test blocked/);
    assert.throws(() => socket.send(buffer, 53, '8.8.8.8'), /Offline test blocked/);
    assert.throws(() => socket.send(buffer, 0, buffer.length, 53, 'example.com'), /Offline test blocked/);
    assert.throws(() => socket.addMembership('224.0.0.1'), /Offline test blocked/);
    assert.throws(() => socket.addSourceSpecificMembership('8.8.8.8', '224.0.0.1'), /Offline test blocked/);
    assert.equal(calls.udp.length, 0); socket.close();
  `);
});
