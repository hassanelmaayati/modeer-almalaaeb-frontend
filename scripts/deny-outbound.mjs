import net from 'node:net';
import dns from 'node:dns';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';

export function isLoopback(host) {
  const value = String(host ?? 'localhost').toLowerCase().replace(/^\[|\]$/g, '');
  if (value === 'localhost') return true;
  if (net.isIP(value) === 4) return value.split('.')[0] === '127';
  if (net.isIP(value) !== 6) return false;
  try {
    const canonical = new URL(`http://[${value}]/`).hostname;
    return canonical === '[::1]' || /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(canonical);
  } catch { return false; }
}

function requireLoopback(host, boundary) {
  if (!isLoopback(host)) throw new Error(`Offline test blocked ${boundary} to ${host}`);
}

const nativeConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  // Node's string overload is a Unix socket or Windows named pipe, never a TCP host.
  if (typeof options === 'string' || (typeof options === 'object' && options?.path)) return nativeConnect.apply(this, args);
  const host = typeof options === 'object' ? options?.host : typeof args[1] === 'string' ? args[1] : 'localhost';
  requireLoopback(host, 'TCP connection');
  // Playwright supplies a custom lookup even for local requests. Replace it rather
  // than rejecting it or allowing it to return a nonlocal address.
  if (options?.lookup) {
    const guarded = { ...options, lookup: dns.lookup };
    if (Array.isArray(args[0])) {
      const normalized = Object.assign([...args[0]], args[0]);
      normalized[0] = guarded;
      args[0] = normalized;
    } else args[0] = guarded;
  }
  return nativeConnect.apply(this, args);
};
const nativeLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  requireLoopback(hostname, 'DNS lookup');
  // Resolve localhost as an IP literal: even a modified hosts file cannot send it elsewhere.
  const local = String(hostname).toLowerCase() === 'localhost'
    ? ((typeof options === 'number' ? options : options?.family) === 6 ? '::1' : '127.0.0.1')
    : String(hostname).replace(/^\[|\]$/g, '');
  return nativeLookup.call(this, local, options, callback);
};
dns.promises.lookup = async function (hostname, options) {
  return new Promise((resolve, reject) => dns.lookup(hostname, options || {}, (error, address, family) => {
    if (error) reject(error);
    else resolve(options?.all ? address : { address, family });
  }));
};

// resolve/reverse use the configured DNS servers, even when resolving localhost.
// Application tests use literal local endpoints and the local-only lookup above.
const resolutionMethods = ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse', 'lookupService'];
for (const method of resolutionMethods) {
  const blocked = (...args) => { throw new Error(`Offline test blocked DNS ${method} for ${args[0]}`); };
  if (typeof dns[method] === 'function') dns[method] = blocked;
  if (typeof dns.Resolver.prototype[method] === 'function') dns.Resolver.prototype[method] = blocked;
  if (typeof dns.promises[method] === 'function') dns.promises[method] = async (...args) => blocked(...args);
  if (typeof dns.promises.Resolver.prototype[method] === 'function') dns.promises.Resolver.prototype[method] = async (...args) => blocked(...args);
}

const nativeUdpConnect = dgram.Socket.prototype.connect;
dgram.Socket.prototype.connect = function (port, address, ...args) {
  requireLoopback(typeof address === 'string' ? address : 'localhost', 'UDP connection');
  return nativeUdpConnect.call(this, port, address, ...args);
};
const nativeSend = dgram.Socket.prototype.send;
dgram.Socket.prototype.send = function (...args) {
  const addressIndex = typeof args[1] === 'number' && typeof args[2] === 'number' && typeof args[3] === 'number' ? 4 : 2;
  const address = typeof args[addressIndex] === 'string' ? args[addressIndex] : 'localhost';
  requireLoopback(address, 'UDP send');
  return nativeSend.apply(this, args);
};
for (const method of ['addMembership', 'addSourceSpecificMembership']) {
  dgram.Socket.prototype[method] = function () { throw new Error('Offline test blocked UDP multicast membership'); };
}

// Keep named imports such as `import { lookup } from 'node:dns'` guarded as well.
syncBuiltinESMExports();
