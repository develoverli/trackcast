import http from 'http';
import { readFile } from 'fs/promises';
import { dirname, extname, join, normalize, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Loopback only: the overlay shows what you're listening to, never expose it to the network.
export const OVERLAY_HOST = '127.0.0.1';
export const OVERLAY_PATH = '/overlay';

const OVERLAY_DIR = join(__dirname, 'overlay');
const FONTS_DIR = join(__dirname, 'renderer', 'assets', 'fonts');
const SSE_HEARTBEAT_MS = 15000;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

let server = null;
let serverPort = null;
let heartbeat = null;
const clients = new Set();
let lastPayload = { track: null, style: null, tracking: true, sentAt: Date.now() };

export function getOverlayUrl(port = serverPort) {
  return `http://${OVERLAY_HOST}:${port}${OVERLAY_PATH}`;
}

export function getOverlayStatus() {
  return { running: server !== null, port: serverPort, url: serverPort ? getOverlayUrl() : null };
}

/** Resolve a request path inside a base directory, refusing traversal outside it. */
function resolveInside(baseDir, relativePath) {
  const resolved = normalize(join(baseDir, relativePath));
  return resolved.startsWith(baseDir + sep) ? resolved : null;
}

async function sendFile(res, filePath) {
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream',
    });
    res.end(body);
  } catch {
    sendNotFound(res);
  }
}

function sendNotFound(res) {
  res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function writeEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function handleEvents(req, res) {
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/event-stream; charset=utf-8',
    Connection: 'keep-alive',
  });
  res.write('retry: 2000\n\n');
  writeEvent(res, { ...lastPayload, sentAt: Date.now() });
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

function handleRequest(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET' });
    res.end();
    return;
  }

  const { pathname } = new URL(req.url, `http://${OVERLAY_HOST}`);

  if (pathname === OVERLAY_PATH || pathname === `${OVERLAY_PATH}/`) {
    sendFile(res, join(OVERLAY_DIR, 'index.html'));
  } else if (pathname === `${OVERLAY_PATH}/events`) {
    handleEvents(req, res);
  } else if (pathname.startsWith(`${OVERLAY_PATH}/fonts/`)) {
    const filePath = resolveInside(FONTS_DIR, pathname.slice(`${OVERLAY_PATH}/fonts/`.length));
    if (filePath && filePath.endsWith('.woff2')) sendFile(res, filePath);
    else sendNotFound(res);
  } else if (pathname.startsWith(`${OVERLAY_PATH}/`)) {
    const filePath = resolveInside(OVERLAY_DIR, pathname.slice(`${OVERLAY_PATH}/`.length));
    if (filePath) sendFile(res, filePath);
    else sendNotFound(res);
  } else {
    sendNotFound(res);
  }
}

/** Start (or restart on a new port) the overlay server. Resolves once listening. */
export async function startOverlayServer(port) {
  if (server && serverPort === port) return getOverlayStatus();
  await stopOverlayServer();

  await new Promise((resolve, reject) => {
    const candidate = http.createServer(handleRequest);
    candidate.once('error', (err) => {
      reject(err.code === 'EADDRINUSE'
        ? new Error(`Port ${port} is already in use. Choose another overlay port in Settings.`)
        : err);
    });
    candidate.listen(port, OVERLAY_HOST, () => {
      server = candidate;
      serverPort = port;
      resolve();
    });
  });

  heartbeat = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n');
  }, SSE_HEARTBEAT_MS);

  return getOverlayStatus();
}

export async function stopOverlayServer() {
  clearInterval(heartbeat);
  heartbeat = null;
  for (const res of clients) res.end();
  clients.clear();
  if (!server) return;
  const closing = server;
  server = null;
  serverPort = null;
  await new Promise((resolve) => closing.close(() => resolve()));
}

/** Push the latest track and/or style to every connected overlay. */
export function publishOverlayState(partial) {
  lastPayload = { ...lastPayload, ...partial, sentAt: Date.now() };
  for (const res of clients) writeEvent(res, lastPayload);
}
