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

export function resetConfig() {
  configCache = { ...DEFAULT_CONFIG };
  saveConfig(configCache);
  return configCache;
}