import { app } from 'electron';

const APP_NAME = 'TrackCast';

export function isAutoLaunchEnabled() {
  return app.getLoginItemSettings().openAtLogin;
}

export async function setAutoLaunch(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    name: APP_NAME,
  });
  return isAutoLaunchEnabled();
}

export function getAutoLaunchSettings() {
  const settings = app.getLoginItemSettings({ name: APP_NAME });
  return {
    enabled: settings.openAtLogin,
    openAtLogin: settings.openAtLogin,
    openAsHidden: settings.openAsHidden ?? false,
  };
}