import log from 'electron-log';
import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, Notification, clipboard } from 'electron';
import path from 'path';
import http from 'http';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { isAutoLaunchEnabled, setAutoLaunch } from './autoLaunch.js';
import { saveConfig, getConfig, OUTPUT_MODES } from './configManager.js';
import { refreshAccessToken, getCurrentlyPlaying, buildAuthorizeUrl, exchangeAuthorizationCode, validateAppCredentials } from './spotify.js';
import { connect as connectOBS, describeObsError, updateTextSource, getOBSsources, createTextSource, applyTextStyle, addOverlaySource } from './obs.js';
import { startOverlayServer, stopOverlayServer, publishOverlayState, getOverlayStatus, getOverlayUrl } from './overlayServer.js';
import { setupAutoUpdater, registerUpdaterIpc, checkForUpdates } from './updater.js';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('Application starting...');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

let mainWindow = null;
let tray = null;
let obsClient = null;
let obsConnecting = null;
let obsReconnectTimer = null;
let pollingInterval = null;
let accessToken = null;
let isQuitting = false;
let reconnectAttempts = 0;
let pollingBackoff = 0;
const MAX_RECONNECT_DELAY = 30000;
let currentTrack = null;
let overlayError = null;
// Shown in a freshly created text source until a track plays; an empty GDI+ source is a 2 px sliver.
const TEXT_SOURCE_PLACEHOLDER = '♪ TrackCast is waiting for Spotify…';
const TOKEN_EXPIRY_BUFFER_MS = 300000; // Refresh 5 min before expiry

// Log buffer for renderer
const logBuffer = [];
const MAX_LOG_BUFFER = 100;

function addLog(level, message) {
  const entry = { timestamp: Date.now(), level, message };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }
  // Send to renderer if window exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log-entry', entry);
  }
}

function createWindow() {
  const config = getConfig();
  
  const iconPath = path.join(__dirname, 'renderer', 'assets', 'icon-256.png');
  const windowState = config.window || {};

  mainWindow = new BrowserWindow({
    width: windowState.width || 1040,
    height: windowState.height || 720,
    x: typeof windowState.x === 'number' ? windowState.x : undefined,
    y: typeof windowState.y === 'number' ? windowState.y : undefined,
    minWidth: 720,
    minHeight: 500,
    title: 'TrackCast',
    icon: iconPath,
    frame: false,
    backgroundColor: '#0d110f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: !config.behavior.startMinimized,
  });

  if (windowState.maximized) {
    mainWindow.maximize();
  }

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Setup auto-updater after window is created
  setupAutoUpdater(mainWindow);

  if (config.behavior.minimizeToTray) {
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
        return false;
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximized', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximized', false);
    }
  });

  const saveWindowState = debounce(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const isMax = mainWindow.isMaximized();
    const bounds = isMax ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    const current = getConfig();
    current.window = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: isMax,
    };
    saveConfig(current);
  }, 500);

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function trayIconForState(state) {
  const valid = state === 'playing' || state === 'error' ? state : 'idle';
  const iconPath = path.join(__dirname, 'renderer', 'assets', 'tray', `tray-${valid}-32.png`);
  return nativeImage.createFromPath(iconPath);
}

function createTray() {
  const trayIcon = trayIconForState('idle');
  tray = new Tray(trayIcon);
  tray.setToolTip('TrackCast');

  updateTrayMenu();

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayIcon(state) {
  if (!tray) return;
  const icon = trayIconForState(state);
  if (!icon.isEmpty()) tray.setImage(icon);
}

function updateTrayMenu() {
  const config = getConfig();
  const trackInfo = currentTrack 
    ? `${currentTrack.trackName} — ${currentTrack.artistName}`
    : 'No track playing';

  const contextMenu = Menu.buildFromTemplate([
    { label: trackInfo, enabled: false },
    { type: 'separator' },
    {
      label: config.polling.enabled ? 'Pause Tracking' : 'Resume Tracking',
      click: () => togglePolling()
    },
    {
      label: 'Verify OBS Connection',
      click: () => testOBSConnection()
    },
    { type: 'separator' },
    {
      label: 'Open Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function updateTrayTooltip() {
  if (tray && currentTrack) {
    tray.setToolTip(`🎵 ${currentTrack.trackName} — ${currentTrack.artistName}`);
  } else if (tray) {
    tray.setToolTip('TrackCast');
  }
}

// ─────────────────────────────────────────────────────────────
// System Notifications
// ─────────────────────────────────────────────────────────────

let lastNotifiedTrackName = null;

function showTrackChangeNotification(track) {
  if (!Notification.isSupported()) return;
  
  // Don't notify if same track or no significant track info
  if (track.trackName === lastNotifiedTrackName) return;
  if (!track.trackName) return;
  
  lastNotifiedTrackName = track.trackName;
  
  const notification = new Notification({
    title: '🎵 Now Playing',
    body: `${track.trackName} — ${track.artistName}`,
    silent: true,
  });
  
  notification.show();
}

const lastConnectionState = { OBS: null, Spotify: null };

function showConnectionNotification(service, connected) {
  if (!Notification.isSupported()) return;
  if (lastConnectionState[service] === connected) return;
  lastConnectionState[service] = connected;

  const notification = new Notification({
    title: service === 'OBS' ? 'OBS Connection' : 'Spotify',
    body: connected
      ? `${service} connected successfully`
      : `Lost connection to ${service}`,
    silent: true,
  });


  notification.show();
}

// ─────────────────────────────────────────────────────────────
// Core polling logic
// ─────────────────────────────────────────────────────────────

function sendsTextSource(config) {
  const mode = OUTPUT_MODES.includes(config.obs.outputMode) ? config.obs.outputMode : 'overlay';
  return mode === 'text' || mode === 'both';
}

// Only what the overlay renders; never credentials.
function overlayStyleFromConfig(config) {
  const { port, ...style } = config.browserOverlay;
  return style;
}

async function startOverlay() {
  const config = getConfig();
  try {
    await startOverlayServer(config.browserOverlay.port);
    overlayError = null;
    publishOverlayState({ style: overlayStyleFromConfig(config), tracking: config.polling.enabled });
    log.info('[Overlay] Serving', getOverlayUrl());
  } catch (error) {
    overlayError = error.message;
    log.error('[Overlay] Could not start overlay server:', error.message);
  }
}

function formatTrack(trackName, artistName) {
  const config = getConfig();
  return config.overlay.format
    .replace('{trackName}', trackName)
    .replace('{artistName}', artistName);
}

async function fetchAndUpdate() {
  const config = getConfig();
  
  if (!config.polling.enabled) return;

  try {
    // Check if token needs proactive refresh
    const now = Date.now();
    const tokenExpiresAt = config.spotify.accessTokenExpiresAt || 0;
    if (tokenExpiresAt > 0 && (tokenExpiresAt - now) < TOKEN_EXPIRY_BUFFER_MS) {
      console.log('[Spotify] Token expiring soon, refreshing proactively');
      try {
        accessToken = await refreshAccessToken(config);
        const updatedConfig = getConfig();
        updatedConfig.spotify.accessToken = accessToken;
        updatedConfig.spotify.accessTokenExpiresAt = Date.now() + 3600000;
        saveConfig(updatedConfig);
        pollingBackoff = 0; // Reset backoff on success
      } catch (refreshError) {
        console.error('[Spotify] Proactive token refresh failed:', refreshError.message);
      }
    }

    const track = await getCurrentlyPlaying(accessToken);

    if (!track) {
      currentTrack = null;
      updateTrayIcon('idle');
      updateTrayMenu();
      updateTrayTooltip();
      pollingBackoff = 0; // Reset backoff on success
      publishOverlayState({ track: null, tracking: true });

      if (sendsTextSource(config)) {
        await updateTextSourceSafe(config.overlay.showOnlyWhenPlaying ? '' : config.overlay.idleText || '');
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('track-update', null);
      }
      reconnectAttempts = 0;
      return;
    }

    currentTrack = track;
    publishOverlayState({ track, tracking: true });

    updateTrayIcon('playing');
    updateTrayMenu();
    updateTrayTooltip();

    showTrackChangeNotification(track);

    if (sendsTextSource(config)) {
      await updateTextSourceSafe(formatTrack(track.trackName, track.artistName));
    }
    reconnectAttempts = 0;
    pollingBackoff = 0; // Reset backoff on success

    // Send to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('track-update', track);
    }

  } catch (error) {
    pollingBackoff = Math.min((pollingBackoff || 0) * 2 + 5000, 60000);
    
    if (error.code === 'TOKEN_EXPIRED') {
      try {
        accessToken = await refreshAccessToken(config);
        const updatedConfig = getConfig();
        updatedConfig.spotify.accessToken = accessToken;
        updatedConfig.spotify.accessTokenExpiresAt = Date.now() + 3600000;
        saveConfig(updatedConfig);
        pollingBackoff = 0;
      } catch (refreshError) {
        updateTrayIcon('error');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('spotify-error', refreshError.message);
        }
      }
      return;
    }

    updateTrayIcon('error');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('spotify-error', error.message);
    }
  }
}

async function updateTextSourceSafe(text) {
  if (!obsClient) return;
  
  const config = getConfig();
  try {
    await updateTextSource(obsClient, config.obs.textSourceName, text);
  } catch (error) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('obs-error', error.message);
    }
  }
}

function handleObsClosed(client) {
  // Ignore close events from a client we already replaced or disconnected on purpose.
  if (client !== obsClient || isQuitting) return;
  obsClient = null;
  log.warn('[OBS] Connection closed');
  updateTrayIcon('error');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('obs-status', { connected: false });
  }
  scheduleOBSReconnect();
}

/** Connect (or reconnect) to OBS. Resolves to { success } or { success: false, error } and never throws. */
async function connectToOBS() {
  if (obsConnecting) return obsConnecting;

  obsConnecting = (async () => {
    const config = getConfig();
    clearTimeout(obsReconnectTimer);
    obsReconnectTimer = null;

    const previous = obsClient;
    obsClient = null;
    if (previous) {
      try { await previous.disconnect(); } catch { /* already closed */ }
    }

    try {
      obsClient = await connectOBS(config, { onClose: handleObsClosed });
      reconnectAttempts = 0;
      log.info('[OBS] Connected to', `${config.obs.host}:${config.obs.port}`);
      updateTrayIcon(currentTrack ? 'playing' : 'idle');
      showConnectionNotification('OBS', true);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('obs-status', { connected: true });
      }
      return { success: true };
    } catch (error) {
      const message = describeObsError(error, config);
      log.warn('[OBS] Connection failed:', message);
      updateTrayIcon('error');
      showConnectionNotification('OBS', false);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('obs-error', message);
      }
      scheduleOBSReconnect();
      return { success: false, error: message };
    }
  })();

  try {
    return await obsConnecting;
  } finally {
    obsConnecting = null;
  }
}

async function ensureObsConnection() {
  return obsClient ? { success: true } : connectToOBS();
}

function scheduleOBSReconnect() {
  const config = getConfig();
  if (!config.behavior.autoReconnect || obsReconnectTimer || isQuitting) return;

  reconnectAttempts++;
  const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
  obsReconnectTimer = setTimeout(() => {
    obsReconnectTimer = null;
    if (!isQuitting) connectToOBS();
  }, delay);
}

function togglePolling() {
  const config = getConfig();
  config.polling.enabled = !config.polling.enabled;
  saveConfig(config);
  publishOverlayState({ tracking: config.polling.enabled });
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('polling-status', config.polling.enabled);
  }
  
  if (config.polling.enabled) {
    fetchAndUpdate();
  }
  
  updateTrayMenu();
}

async function testOBSConnection() {
  return connectToOBS();
}

// ─────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────

async function initializeApp() {
  const config = getConfig();
  
  // Get initial access token
  try {
    accessToken = await refreshAccessToken(config);
    const updatedConfig = getConfig();
    updatedConfig.spotify.accessToken = accessToken;
    updatedConfig.spotify.accessTokenExpiresAt = Date.now() + 3600000;
    saveConfig(updatedConfig);
  } catch (error) {
    console.error('Failed to get initial access token:', error.message);
  }

  // Serve the browser overlay (also used by the in-app preview during setup)
  await startOverlay();

  // Connect to OBS
  await connectToOBS();

  // Start polling if setup is completed
  if (config.setup.completed && config.polling.enabled) {
    pollingInterval = setInterval(fetchAndUpdate, config.polling.intervalMs);
    fetchAndUpdate();
  }

  // Check for updates (non-blocking, only in production)
  if (!process.argv.includes('--dev')) {
    setTimeout(() => checkForUpdates(), 3000);
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  initializeApp();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Don't quit if minimize to tray is enabled
    const config = getConfig();
    if (!config.behavior.minimizeToTray) {
      app.quit();
    }
  }
});

app.on('quit', () => {
  stopOverlayServer();
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  if (obsClient) {
    try {
      obsClient.disconnect();
    } catch {}
  }
});

// ─────────────────────────────────────────────────────────────
// IPC handlers (communication with renderer)
// ─────────────────────────────────────────────────────────────

ipcMain.handle('get-config', () => {
  return getConfig();
});

ipcMain.handle('save-config', async (event, config) => {
  const previousPort = getOverlayStatus().port;
  saveConfig(config);

  if (config.browserOverlay.port !== previousPort) {
    await startOverlay();
  } else {
    publishOverlayState({ style: overlayStyleFromConfig(config) });
  }
  return { success: true, overlay: { ...getOverlayStatus(), error: overlayError } };
});

ipcMain.handle('overlay-get-status', () => {
  return { ...getOverlayStatus(), error: overlayError };
});

ipcMain.handle('overlay-add-to-obs', async () => {
  const status = getOverlayStatus();
  if (!status.running) {
    return { success: false, error: overlayError || 'The overlay server is not running.' };
  }
  const connection = await ensureObsConnection();
  if (!connection.success) {
    return { success: false, error: connection.error };
  }
  try {
    const result = await addOverlaySource(obsClient, status.url);
    log.info('[Overlay] Browser source', result.created ? 'created in' : 'updated in', result.sceneName || '(no scene)');
    return { success: true, ...result };
  } catch (error) {
    log.error('[Overlay] Could not add browser source:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-obs-connection', async () => {
  return await testOBSConnection();
});

ipcMain.handle('obs-check-source', async (event, sourceName) => {
  const connection = await ensureObsConnection();
  if (!connection.success) return { error: connection.error };
  try {
    const inputs = await getOBSsources(obsClient);
    const target = String(sourceName || '').trim();
    if (!target) return { error: 'Empty source name' };

    const exact = inputs.find((i) => i.inputName === target);
    if (exact) {
      let sceneName = null;
      try {
        const sceneResp = await obsClient.call('GetCurrentProgramScene');
        sceneName = sceneResp.currentProgramSceneName;
      } catch {}
      return { exists: true, sceneName };
    }

    const ci = inputs.find((i) => i.inputName.toLowerCase() === target.toLowerCase());
    if (ci) return { exists: false, suggestion: ci.inputName };

    return { exists: false };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('obs-create-source', async (event, sourceName) => {
  const connection = await ensureObsConnection();
  if (!connection.success) return { error: connection.error };
  try {
    const config = getConfig();
    const result = await createTextSource(obsClient, sourceName, {
      text: currentTrack ? formatTrack(currentTrack.trackName, currentTrack.artistName) : TEXT_SOURCE_PLACEHOLDER,
      style: config.overlay.textStyle,
      corner: config.browserOverlay.corner,
    });
    return { success: true, sceneName: result.sceneName };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('obs-apply-text-style', async () => {
  const connection = await ensureObsConnection();
  if (!connection.success) return { success: false, error: connection.error };
  const config = getConfig();
  try {
    await applyTextStyle(obsClient, config.obs.textSourceName, config.overlay.textStyle);
    return { success: true };
  } catch (e) {
    const missing = /No source was found|not found/i.test(e.message);
    return {
      success: false,
      error: missing ? `There is no source named "${config.obs.textSourceName}" in OBS yet. Create it first.` : e.message,
    };
  }
});

ipcMain.handle('toggle-polling', () => {
  togglePolling();
  return getConfig().polling.enabled;
});

ipcMain.handle('get-current-track', () => {
  return currentTrack;
});

ipcMain.handle('start-polling', () => {
  const config = getConfig();
  if (!pollingInterval) {
    pollingInterval = setInterval(fetchAndUpdate, config.polling.intervalMs);
    fetchAndUpdate();
  }
  return { success: true };
});

ipcMain.handle('stop-polling', () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  return { success: true };
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('show-item-in-folder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('clipboard-write-text', (event, text) => {
  clipboard.writeText(String(text));
  return { success: true };
});

ipcMain.handle('clipboard-read-text', () => {
  return clipboard.readText();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-log-buffer', () => {
  return logBuffer;
});

// ─────────────────────────────────────────────────────────────
// Window controls (frameless)
// ─────────────────────────────────────────────────────────────

ipcMain.handle('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

ipcMain.handle('window-maximize-toggle', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});

ipcMain.handle('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
});

// ─────────────────────────────────────────────────────────────
// Auto-updater IPC
// ─────────────────────────────────────────────────────────────

registerUpdaterIpc(ipcMain);

// ─────────────────────────────────────────────────────────────
// Auto-launch (Windows startup)
// ─────────────────────────────────────────────────────────────

ipcMain.handle('get-auto-launch', () => {
  return isAutoLaunchEnabled();
});

ipcMain.handle('set-auto-launch', async (event, enabled) => {
  try {
    await setAutoLaunch(enabled);
    return { success: true, enabled: isAutoLaunchEnabled() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─────────────────────────────────────────────────────────────
// Spotify Auth Server
// ─────────────────────────────────────────────────────────────

const AUTH_TIMEOUT_MS = 300000; // 5 minutes
const DEFAULT_AUTH_PORT = 8888;
let pendingAuth = null;

const AUTH_PAGE_SUCCESS = '<h1>Success!</h1><p>You can close this window and return to TrackCast.</p>';
const AUTH_PAGE_ERROR = '<h1>Authorization failed</h1><p>Return to TrackCast for details.</p>';

function waitForAuthCode(redirectUri, expectedState) {
  return new Promise((resolve, reject) => {
    const redirectUrl = new URL(redirectUri);
    const port = Number(redirectUrl.port) || DEFAULT_AUTH_PORT;
    let settled = false;

    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, redirectUrl.origin);

      if (parsedUrl.pathname !== redirectUrl.pathname) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const spotifyError = parsedUrl.searchParams.get('error');
      const code = parsedUrl.searchParams.get('code');
      const state = parsedUrl.searchParams.get('state');

      let failure = null;
      if (spotifyError) {
        failure = new Error(`Spotify authorization was denied (${spotifyError})`);
      } else if (state !== expectedState) {
        failure = new Error('Authorization state mismatch. Please try again.');
      } else if (!code) {
        failure = new Error('No authorization code received');
      }

      res.writeHead(failure ? 400 : 200, { 'Content-Type': 'text/html' });
      res.end(failure ? AUTH_PAGE_ERROR : AUTH_PAGE_SUCCESS);
      finish(failure, code);
    });

    const timeout = setTimeout(() => finish(new Error('Authorization timed out')), AUTH_TIMEOUT_MS);

    function finish(err, code) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close();
      pendingAuth = null;
      if (err) reject(err);
      else resolve(code);
    }

    server.on('error', (err) => {
      finish(err.code === 'EADDRINUSE'
        ? new Error(`Port ${port} is already in use. Close the app using it and try again.`)
        : err);
    });

    // Listen only on the redirect host (loopback), never on all interfaces.
    server.listen(port, redirectUrl.hostname, () => {
      log.info('[Auth] Callback server listening on', `${redirectUrl.hostname}:${port}`);
    });

    pendingAuth = { cancel: () => finish(new Error('Authorization cancelled')) };
  });
}

ipcMain.handle('spotify-authorize', async (event, credentials) => {
  if (pendingAuth) pendingAuth.cancel();

  const credentialError = validateAppCredentials(credentials);
  if (credentialError) {
    return { success: false, error: credentialError };
  }

  try {
    const config = getConfig();
    config.spotify.clientId = credentials.clientId;
    config.spotify.clientSecret = credentials.clientSecret;
    config.spotify.redirectUri = credentials.redirectUri;
    saveConfig(config);

    const state = randomBytes(16).toString('hex');
    const codePromise = waitForAuthCode(config.spotify.redirectUri, state);

    try {
      await shell.openExternal(buildAuthorizeUrl(config.spotify, state));
    } catch (openError) {
      if (pendingAuth) pendingAuth.cancel();
      await codePromise.catch(() => {});
      throw openError;
    }

    const code = await codePromise;
    const tokens = await exchangeAuthorizationCode(config.spotify, code);

    const updatedConfig = getConfig();
    updatedConfig.spotify.refreshToken = tokens.refreshToken;
    updatedConfig.spotify.accessToken = tokens.accessToken;
    updatedConfig.spotify.accessTokenExpiresAt = Date.now() + tokens.expiresInMs;
    updatedConfig.spotify.redirectUriMigrated = false;
    saveConfig(updatedConfig);
    accessToken = tokens.accessToken;

    log.info('[Auth] Spotify authorization successful');
    return { success: true, config: updatedConfig };
  } catch (err) {
    log.error('[Auth] Spotify authorization failed:', err.message);
    return { success: false, error: err.message };
  }
});