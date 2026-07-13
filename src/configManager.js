import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { app } from 'electron';
import dotenv from 'dotenv';

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
const LEGACY_ENV_PATH = join(__dirname, '..', '.env');

dotenv.config({ path: LEGACY_ENV_PATH });

const DEFAULT_CONFIG = {
  version: '1.0.0',
  spotify: {
    clientId: '',
    clientSecret: '',
    redirectUri: 'http://localhost:8888/callback',
    refreshToken: '',
    accessToken: '',
    accessTokenExpiresAt: 0,
  },
  obs: {
    host: 'localhost',
    port: 4455,
    password: '',
    textSourceName: 'SpotifyNowPlaying',
  },
  polling: {
    intervalMs: 5000,
    enabled: true,
  },
  overlay: {
    format: '\ud83c\udfb5 {trackName} \u2014 {artistName}',
    idleText: '',
    showOnlyWhenPlaying: true,
    showAlbumArt: false,
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
      configCache = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      configCache.spotify = { ...DEFAULT_CONFIG.spotify, ...configCache.spotify };
      configCache.obs = { ...DEFAULT_CONFIG.obs, ...configCache.obs };
      configCache.polling = { ...DEFAULT_CONFIG.polling, ...configCache.polling };
      configCache.overlay = { ...DEFAULT_CONFIG.overlay, ...configCache.overlay };
      configCache.behavior = { ...DEFAULT_CONFIG.behavior, ...configCache.behavior };
      configCache.setup = { ...DEFAULT_CONFIG.setup, ...configCache.setup };
    } catch (e) {
      console.error('[Config] Error reading config.json, using defaults:', e.message);
      configCache = { ...DEFAULT_CONFIG };
    }
  } else {
    configCache = migrateFromEnv();
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

function migrateFromEnv() {
  const envConfig = { ...DEFAULT_CONFIG };

  // Try to read from .env (backwards compat)
  if (process.env.SPOTIFY_CLIENT_ID) {
    envConfig.spotify.clientId = process.env.SPOTIFY_CLIENT_ID;
  }
  if (process.env.SPOTIFY_CLIENT_SECRET) {
    envConfig.spotify.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  }
  if (process.env.SPOTIFY_REDIRECT_URI) {
    envConfig.spotify.redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  }
  if (process.env.SPOTIFY_REFRESH_TOKEN) {
    envConfig.spotify.refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  }
  if (process.env.OBS_HOST) {
    envConfig.obs.host = process.env.OBS_HOST;
  }
  if (process.env.OBS_PORT) {
    envConfig.obs.port = parseInt(process.env.OBS_PORT, 10);
  }
  if (process.env.OBS_PASSWORD) {
    envConfig.obs.password = process.env.OBS_PASSWORD;
  }
  if (process.env.NAME_GUI_TEXT_OBS) {
    envConfig.obs.textSourceName = process.env.NAME_GUI_TEXT_OBS;
  }
  if (process.env.TIME) {
    envConfig.polling.intervalMs = parseInt(process.env.TIME, 10);
  }

  // If we found any spotify credentials, consider setup completed
  if (envConfig.spotify.clientId && envConfig.spotify.refreshToken) {
    envConfig.setup.completed = true;
  }

  return envConfig;
}

export function resetConfig() {
  configCache = { ...DEFAULT_CONFIG };
  saveConfig(configCache);
  return configCache;
}