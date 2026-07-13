import electronUpdater from 'electron-updater';
import log from 'electron-log';

const { autoUpdater } = electronUpdater;

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let mainWindow = null;
let updateAvailable = false;
let updateDownloaded = false;

export function setupAutoUpdater(window) {
  mainWindow = window;

  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for updates...');
    sendStatusToWindow('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] Update available:', info.version);
    updateAvailable = true;
    sendStatusToWindow(`Update available: v${info.version}`);
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('[Updater] No update available. Current version:', info.version);
    sendStatusToWindow('App is up to date');
  });

  autoUpdater.on('error', (err) => {
    log.error('[Updater] Error:', err.message);
    sendStatusToWindow(null);
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    log.info(`[Updater] Download progress: ${percent}%`);
    sendStatusToWindow(`Downloading update: ${percent}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] Update downloaded:', info.version);
    updateDownloaded = true;
    sendStatusToWindow(`Update ready: v${info.version}. Restart to apply.`);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes,
      });
    }
  });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
}

export function registerUpdaterIpc(ipcMain) {
  ipcMain.handle('check-for-updates', async () => {
    if (updateAvailable || updateDownloaded) {
      return { available: updateAvailable, downloaded: updateDownloaded };
    }
    try {
      await checkForUpdates();
      return { checking: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('install-update', () => {
    if (updateDownloaded) {
      installUpdate();
      return { success: true };
    }
    return { error: 'No update downloaded' };
  });

  ipcMain.handle('get-update-status', () => {
    return {
      available: updateAvailable,
      downloaded: updateDownloaded,
    };
  });
}

function sendStatusToWindow(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater-status', message);
  }
}

export async function checkForUpdates() {
  try {
    if (updateAvailable || updateDownloaded) {
      log.info('[Updater] Update already in progress or downloaded');
      return;
    }
    await autoUpdater.checkForUpdates();
  } catch (err) {
    log.error('[Updater] Check failed:', err.message);
  }
}

export function installUpdate() {
  if (!updateDownloaded) {
    log.warn('[Updater] No update downloaded to install');
    return;
  }
  log.info('[Updater] Installing update and restarting...');
  autoUpdater.quitAndInstall(false, true);
}

export function isUpdateDownloaded() {
  return updateDownloaded;
}
