import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // OBS
  testOBSConnection: () => ipcRenderer.invoke('test-obs-connection'),
  obsCheckSource: (name) => ipcRenderer.invoke('obs-check-source', name),
  obsCreateSource: (name) => ipcRenderer.invoke('obs-create-source', name),

  // Polling
  togglePolling: () => ipcRenderer.invoke('toggle-polling'),
  startPolling: () => ipcRenderer.invoke('start-polling'),
  stopPolling: () => ipcRenderer.invoke('stop-polling'),
  getCurrentTrack: () => ipcRenderer.invoke('get-current-track'),

  // System
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
  getLogBuffer: () => ipcRenderer.invoke('get-log-buffer'),

  // Spotify Auth
  waitForAuthCode: () => ipcRenderer.invoke('wait-for-auth-code'),
  startAuthServer: (config) => ipcRenderer.invoke('start-auth-server', config),

  // Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),

  // Auto-launch
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximizeToggle: () => ipcRenderer.invoke('window-maximize-toggle'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximized: (callback) => {
    ipcRenderer.on('window-maximized', (event, isMax) => callback(isMax));
  },

  // Event listeners
  onTrackUpdate: (callback) => {
    ipcRenderer.on('track-update', (event, track) => callback(track));
  },
  onOBSStatus: (callback) => {
    ipcRenderer.on('obs-status', (event, status) => callback(status));
  },
  onOBSError: (callback) => {
    ipcRenderer.on('obs-error', (event, error) => callback(error));
  },
  onSpotifyError: (callback) => {
    ipcRenderer.on('spotify-error', (event, error) => callback(error));
  },
  onPollingStatus: (callback) => {
    ipcRenderer.on('polling-status', (event, enabled) => callback(enabled));
  },
  onLogEntry: (callback) => {
    ipcRenderer.on('log-entry', (event, entry) => callback(entry));
  },
  onUpdaterStatus: (callback) => {
    ipcRenderer.on('updater-status', (event, message) => callback(message));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
