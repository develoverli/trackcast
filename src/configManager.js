import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { app } from 'electron';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveUserDataDir() {
  try {
    const dir = app.getPath('userData');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    return join(__dirname, '..');
  }
}

const USER_DATA_DIR = resolveUserDataDir();
const CONFIG_PATH = join(USER_DATA_DIR, 'config.json');
const LEGACY_CONFIG_PATH = join(__dirname, '..', 'config.json');

// Spotify rejects `localhost` redirect URIs; loopback redirects must use an explicit IP.
export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const LOOPBACK_HOST = '127.0.0.1';
const LEGACY_LOOPBACK_HOST = 'localhost';

export const OUTPUT_MODES = ['overlay', 'text', 'both'];
export const DEFAULT_OVERLAY_PORT = 8890;

// Maps the pre-theme `browserOverlay.background` setting to the new surface keys.
const LEGACY_BACKGROUNDS = {
  dark: { surfaceColor: '#0c100e', surfaceOpacity: 0.82, textColor: '#f4f7f5', effect: 'shadow' },
  solid: { surfaceColor: '#111613', surfaceOpacity: 1, textColor: '#f4f7f5', effect: 'shadow' },
  light: { surfaceColor: '#fafbfa', surfaceOpacity: 0.94, textColor: '#141a17', effect: 'shadow' },
  transparent: { surfaceColor: '#000000', surfaceOpacity: 0, textColor: '#ffffff', effect: 'text-shadow' },
};

const DEFAULT_CONFIG = {
  version: '1.0.0',
  spotify: {
    clientId: '',
    clientSecret: '',
    redirectUri: SPOTIFY_REDIRECT_URI,
    // True when a saved `localhost` redirect URI was rewritten and the user still
    // has to update it in their Spotify app. Cleared on re-authorization or dismiss.
    redirectUriMigrated: false,
    refreshToken: '',
    accessToken: '',
    accessTokenExpiresAt: 0,
  },
  obs: {
    host: 'localhost',
    port: 4455,
    password: '',
    textSourceName: 'SpotifyNowPlaying',
    // What TrackCast sends to OBS: the browser overlay, the plain text source, or both.
    outputMode: 'overlay',
  },
  polling: {
    intervalMs: 5000,
    enabled: true,
  },
  overlay: {
    format: '\ud83c\udfb5 {trackName} \u2014 {artistName}',
    idleText: '',
    showOnlyWhenPlaying: true,
    textTheme: 'clean',
    textStyle: {
      face: 'Segoe UI',
      size: 42,
      bold: true,
      italic: false,
      uppercase: false,
      color: '#ffffff',
      opacity: 100,
      gradientColor: null,
      outlineColor: '#000000',
      outlineSize: 3,
      backgroundColor: '#000000',
      backgroundOpacity: 0,
    },
  },
  browserOverlay: {
    port: DEFAULT_OVERLAY_PORT,
    theme: 'trackcast',
    layout: 'card',
    accent: '#30e07a',
    accent2: '#2ec4ce',
    surfaceColor: '#0c100e',
    surfaceOpacity: 0.82,
    textColor: '#f4f7f5',
    font: 'jakarta',
    radius: 'rounded',
    border: 'subtle',
    effect: 'shadow',
    uppercaseTitle: false,
    corner: 'bottom-left',
    animation: 'slide',
    scale: 1,
    showAlbumArt: true,
    showArtist: true,
    showAlbum: false,
    showProgress: true,
    whenPaused: 'hide',
    idleMessage: 'Be right back',
    labels: {
      nowPlaying: 'Now playing',
      paused: 'Paused',
    },
  },
  customThemes: {
    overlay: [],
    text: [],
  },
  behavior: {
    startMinimized: false,
    minimizeToTray: true,
    autoStartWithWindows: false,
    autoReconnect: true,
  },
  setup: {
    completed: false,
  },
};

let configCache = null;

export function loadConfig() {
  if (configCache) return configCache;

  let sourcePath = null;
  if (existsSync(CONFIG_PATH)) {
    sourcePath = CONFIG_PATH;
  } else if (existsSync(LEGACY_CONFIG_PATH)) {
    sourcePath = LEGACY_CONFIG_PATH;
  }

  if (sourcePath) {
    try {
      const raw = readFileSync(sourcePath, 'utf-8');
      const parsed = JSON.parse(raw);
      configCache = { ...DEFAULT_CONFIG, ...parsed };
      configCache.spotify = { ...DEFAULT_CONFIG.spotify, ...configCache.spotify };
      configCache.obs = { ...DEFAULT_CONFIG.obs, ...configCache.obs };
      configCache.polling = { ...DEFAULT_CONFIG.polling, ...configCache.polling };
      configCache.overlay = {
        ...DEFAULT_CONFIG.overlay,
        ...configCache.overlay,
        textStyle: { ...DEFAULT_CONFIG.overlay.textStyle, ...configCache.overlay?.textStyle },
      };
      configCache.customThemes = {
        overlay: Array.isArray(parsed.customThemes?.overlay) ? parsed.customThemes.overlay : [],
        text: Array.isArray(parsed.customThemes?.text) ? parsed.customThemes.text : [],
      };
      configCache.browserOverlay = {
        ...DEFAULT_CONFIG.browserOverlay,
        ...configCache.browserOverlay,
        ...LEGACY_BACKGROUNDS[parsed.browserOverlay?.background],
        ...pickDefined(parsed.browserOverlay, ['surfaceColor', 'surfaceOpacity', 'textColor', 'effect']),
        labels: { ...DEFAULT_CONFIG.browserOverlay.labels, ...configCache.browserOverlay?.labels },
      };
      delete configCache.browserOverlay.background;
      configCache.behavior = { ...DEFAULT_CONFIG.behavior, ...configCache.behavior };
      configCache.setup = { ...DEFAULT_CONFIG.setup, ...configCache.setup };

      // Installations set up before the browser overlay existed keep using the text source.
      if (!parsed.obs?.outputMode && configCache.setup.completed) {
        configCache.obs.outputMode = 'text';
      }

      if (migrateLocalhostRedirectUri(configCache)) {
        try {
          saveConfig(configCache);
          console.log('[Config] Migrated Spotify redirect URI to', configCache.spotify.redirectUri);
        } catch (e) {
          console.error('[Config] Could not persist redirect URI migration:', e.message);
        }
      }
    } catch (e) {
      console.error('[Config] Error reading config.json, using defaults:', e.message);
      configCache = { ...DEFAULT_CONFIG };
    }
  } else {
    configCache = { ...DEFAULT_CONFIG };
  }

  return configCache;
}

export function saveConfig(config) {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    configCache = config;
  } catch (e) {
    console.error('[Config] Error saving config.json:', e.message);
    throw e;
  }
}

export function updateConfig(partial) {
  const current = loadConfig();
  const updated = { ...current, ...partial };
  saveConfig(updated);
  return updated;
}

export function getConfig() {
  return loadConfig();
}

function pickDefined(source, keys) {
  const picked = {};
  for (const key of keys) {
    if (source && source[key] !== undefined) picked[key] = source[key];
  }
  return picked;
}

function migrateLocalhostRedirectUri(config) {
  let url;
  try {
    url = new URL(config.spotify.redirectUri);
  } catch {
    return false;
  }
  if (url.hostname !== LEGACY_LOOPBACK_HOST) return false;

  url.hostname = LOOPBACK_HOST;
  config.spotify.redirectUri = url.toString();
  // Only users who already authorized need to update their Spotify app.
  config.spotify.redirectUriMigrated = Boolean(config.spotify.refreshToken);
  return true;
}

export function resetConfig() {
  configCache = { ...DEFAULT_CONFIG };
  saveConfig(configCache);
  return configCache;
}