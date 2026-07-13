import log from 'electron-log';
import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, Notification } from 'electron';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { isAutoLaunchEnabled, setAutoLaunch } from './autoLaunch.js';
import { saveConfig, getConfig } from './configManager.js';
import { refreshAccessToken, getCurrentlyPlaying } from './spotify.js';
import { connect as connectOBS, updateTextSource, getOBSsources, createTextSource } from './obs.js';
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
let pollingInterval = null;
let accessToken = null;
let isQuitting = false;
let reconnectAttempts = 0;
let pollingBackoff = 0;
const MAX_RECONNECT_DELAY = 30000;
let currentTrack = null;
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
    width: windowState.width || 880,
    height: windowState.height || 600,
    x: typeof windowState.x === 'number' ? windowState.x : undefined,
    y: typeof windowState.y === 'number' ? windowState.y : undefined,
    minWidth: 720,
    minHeight: 500,
    title: 'TrackCast',
    icon: iconPath,
    frame: false,
    backgroundColor: '#0a0b0a',
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
      
      if (!config.overlay.showOnlyWhenPlaying) {
        await updateTextSourceSafe(config.overlay.idleText || '');
      } else {
        await updateTextSourceSafe('');
      }
      reconnectAttempts = 0;
      return;
    }

    currentTrack = track;
    const text = formatTrack(track.trackName, track.artistName);
    
    updateTrayIcon('playing');
    updateTrayMenu();
    updateTrayTooltip();
    
    showTrackChangeNotification(track);
    
    await updateTextSourceSafe(text);
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

async function connectToOBS() {
  const config = getConfig();
  
  try {
    if (obsClient) {
      try {
        await obsClient.disconnect();
      } catch {}
    }
    
    obsClient = await connectOBS(config);
    reconnectAttempts = 0;
    updateTrayIcon(currentTrack ? 'playing' : 'idle');
    showConnectionNotification('OBS', true);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('obs-status', { connected: true });
    }
  } catch (error) {
    updateTrayIcon('error');
    showConnectionNotification('OBS', false);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('obs-error', error.message);
    }
    
    scheduleOBSReconnect();
  }
}

function scheduleOBSReconnect() {
  const config = getConfig();
  if (!config.behavior.autoReconnect) return;
  
  reconnectAttempts++;
  const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
  
  setTimeout(() => {
    if (!isQuitting) {
      connectToOBS();
    }
  }, delay);
}

function togglePolling() {
  const config = getConfig();
  config.polling.enabled = !config.polling.enabled;
  saveConfig(config);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('polling-status', config.polling.enabled);
  }
  
  if (config.polling.enabled) {
    fetchAndUpdate();
  }
  
  updateTrayMenu();
}

async function testOBSConnection() {
  try {
    await connectToOBS();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
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

ipcMain.handle('save-config', (event, config) => {
  saveConfig(config);
  return { success: true };
});

ipcMain.handle('test-obs-connection', async () => {
  return await testOBSConnection();
});

ipcMain.handle('obs-check-source', async (event, sourceName) => {
  if (!obsClient) {
    try { await connectToOBS(); } catch (e) { return { error: e.message }; }
  }
  if (!obsClient) return { error: 'Not connected to OBS' };
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
  if (!obsClient) {
    try { await connectToOBS(); } catch (e) { return { error: e.message }; }
  }
  if (!obsClient) return { error: 'Not connected to OBS' };
  try {
    const result = await createTextSource(obsClient, sourceName, {});
    return { success: true, sceneName: result.sceneName };
  } catch (e) {
    return { error: e.message };
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

let authResolve = null;
let authReject = null;

ipcMain.handle('wait-for-auth-code', () => {
  return new Promise((resolve, reject) => {
    authResolve = resolve;
    authReject = reject;
    
    // Timeout after 5 minutes
    setTimeout(() => {
      if (authResolve) {
        authReject(new Error('Authorization timeout'));
        authResolve = null;
        authReject = null;
      }
    }, 300000);
  });
});

ipcMain.handle('start-auth-server', async (event, config) => {
  return new Promise((resolve, reject) => {
    const redirectUrl = new URL(config.spotify.redirectUri);
    const port = redirectUrl.port || 8888;

    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://localhost:${port}`);

      if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.searchParams.get('code');
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Success!</h1><p>You can close this window. Return to the app.</p>');
          
          server.close(() => {
            if (authResolve) {
              authResolve(code);
              authResolve = null;
              authReject = null;
            }
          });
          
          resolve(code);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error</h1><p>No authorization code received.</p>');
          
          server.close(() => {
            if (authReject) {
              authReject(new Error('No authorization code'));
              authResolve = null;
              authReject = null;
            }
          });
          
          reject(new Error('No authorization code'));
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      console.log('[Auth] Server listening on port', port);
    });

    server.on('error', (err) => {
      if (authReject) {
        authReject(err);
        authResolve = null;
        authReject = null;
      }
      reject(err);
    });
  });
});