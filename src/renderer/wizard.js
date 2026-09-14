const SPOTIFY_DASHBOARD_URL = 'https://developer.spotify.com/dashboard';
const PROJECT_URL = 'https://github.com/develoverli/trackcast';
const SUPPORT_URL = 'https://ko-fi.com/develover';
const SPOTIFY_APP_NAME = 'TrackCast';
const SPOTIFY_APP_DESCRIPTION = 'Shows my currently playing Spotify track as a live overlay in OBS Studio.';
const COPY_FEEDBACK_MS = 2000;
// Spotify Client IDs and secrets are 32 hexadecimal characters.
const SPOTIFY_CREDENTIAL_PATTERN = /^[0-9a-f]{32}$/i;
const URL_PATTERN = /^https?:\/\//i;
const SAVE_FEEDBACK_MS = 3000;
const WIZARD_STEPS = ['spotify', 'obs', 'overlay', 'behavior'];
const HERO_STEPS = ['welcome', 'complete'];

// State
let config = null;
let currentStep = 'welcome';
let isPollingEnabled = true;
let appShellReady = false;
const connectionState = { spotify: 'idle', obs: 'idle', textSourceError: null };

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  config = await window.api.getConfig();

  setupWindowControls();
  setupFieldHelpers();

  if (config.setup.completed) {
    openAppShell();
  } else {
    showStep('welcome');
    setupWizardListeners();
  }

  setupStatusListeners();
  setupGlobalListeners();
});

// ─────────────────────────────────────────────────────────────
// Window controls (frameless chrome)
// ─────────────────────────────────────────────────────────────

function setupWindowControls() {
  const min = document.getElementById('win-minimize');
  const max = document.getElementById('win-maximize');
  const close = document.getElementById('win-close');
  const maxIcon = document.getElementById('win-maximize-icon');

  document.getElementById('btn-support').addEventListener('click', () => window.api.openExternal(SUPPORT_URL));

  if (min) min.addEventListener('click', () => window.api.windowMinimize());
  if (max) max.addEventListener('click', () => window.api.windowMaximizeToggle());
  if (close) close.addEventListener('click', () => window.api.windowClose());

  function setMaximizedIcon(isMax) {
    if (!maxIcon) return;
    if (isMax) {
      maxIcon.innerHTML = '<rect x="3.5" y="1.5" width="7" height="7"/><rect x="1.5" y="3.5" width="7" height="7"/>';
      max.setAttribute('aria-label', 'Restore');
      max.setAttribute('title', 'Restore');
    } else {
      maxIcon.innerHTML = '<rect x="2" y="2" width="8" height="8"/>';
      max.setAttribute('aria-label', 'Maximize');
      max.setAttribute('title', 'Maximize');
    }
  }

  window.api.windowIsMaximized().then(setMaximizedIcon);
  window.api.onWindowMaximized(setMaximizedIcon);
}

// ─────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────

function showStep(stepName) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const step = document.getElementById(`step-${stepName}`);
  if (!step) return;

  step.classList.add('active');
  currentStep = stepName;

  const wizard = document.getElementById('wizard-container');
  wizard.classList.toggle('wizard--hero', HERO_STEPS.includes(stepName));
  updateStepper(stepName);
  document.getElementById('app-main').scrollTop = 0;
}

function updateStepper(stepName) {
  const stepper = document.getElementById('wizard-stepper');
  const index = WIZARD_STEPS.indexOf(stepName);
  stepper.hidden = index === -1;
  stepper.querySelectorAll('.stepper__item').forEach((item, i) => {
    item.classList.toggle('is-done', i < index);
    item.classList.toggle('is-current', i === index);
    if (i === index) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
}

function showView(viewName) {
  const wizard = document.getElementById('wizard-container');
  if (wizard) wizard.hidden = true;

  document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
  const view = document.getElementById(`view-${viewName}`);
  if (view) {
    view.hidden = false;
    currentStep = viewName;
  }

  document.querySelectorAll('.sidebar__item').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.view === viewName);
  });
}

function openAppShell() {
  if (!appShellReady) {
    appShellReady = true;
    enableAppShell();
    setupSidebarListeners();
    setupHelpLanguageToggle();
    setupOverlayEditor();
    loadSettingsValues();
    setupSettingsListeners();
    setupRedirectUriNotice();
  }
  mountOverlayEditor('overlay-view-slot', 'module');
  loadOverlayEditor();
  showView('home');
  updatePollingLabel(config.polling.enabled !== false);
  window.api.getCurrentTrack().then((track) => renderNowPlaying(track));
}

function enableAppShell() {
  const sidebar = document.getElementById('sidebar');
  const body = document.getElementById('app-body');
  if (sidebar) sidebar.hidden = false;
  if (body) body.classList.remove('app-body--wizard');
}

// ─────────────────────────────────────────────────────────────
// Help view i18n
// ─────────────────────────────────────────────────────────────

const HELP_I18N = {
  en: {
    'help.title': 'Help & Setup Guide',
    'help.lede': 'Everything you need to get TrackCast working with Spotify and OBS.',
    'help.quickstart.title': 'Quick Start',
    'help.quickstart.body': '<li>Create a free Spotify Developer app and copy its Client ID and Secret.</li><li>Turn on OBS WebSocket (Tools menu inside OBS Studio).</li><li>Run this app and follow the wizard. Done.</li>',
    'help.spotify.title': 'Step 1 · Create a Spotify Developer App',
    'help.spotify.body': '<li>Go to <strong>developer.spotify.com/dashboard</strong> and sign in with your Spotify account.</li><li>Click <strong>Create app</strong>. Name and description can be anything.</li><li>In <strong>Redirect URIs</strong> add exactly: <code>http://127.0.0.1:8888/callback</code></li><li>Save. Open the app, then click <strong>Settings</strong> to copy your Client ID and Client Secret.</li>',
    'help.obs.title': 'Step 2 · Enable OBS WebSocket',
    'help.obs.body': '<li>Open OBS Studio.</li><li>Top menu: <strong>Tools → WebSocket Server Settings</strong>.</li><li>Check <strong>Enable WebSocket server</strong>.</li><li>Set a server password and note it down. Default port is <code>4455</code>.</li><li>Click OK.</li>',
    'help.source.title': 'Step 3 · Add the overlay to OBS',
    'help.source.body': 'In step 3 of the wizard, or in the Overlay module, choose Browser overlay, pick a layout and click "Add to OBS". TrackCast creates a "TrackCast Overlay" browser source in your current scene that covers the whole canvas, so you never need to resize it. Prefer plain text? Choose Text source and click "Check or create it in OBS".',
    'help.format.title': 'Customizing the overlay text',
    'help.format.intro': 'The format field accepts two placeholders:',
    'help.format.list': '<li><code>{trackName}</code> &mdash; current track title</li><li><code>{artistName}</code> &mdash; artist or comma-separated artists</li>',
    'help.format.example': 'Example: <code>♫ {trackName} by {artistName}</code>',
    'help.troubleshoot.title': 'Troubleshooting',
    'help.troubleshoot.body': '<dt>The overlay does not appear in OBS</dt><dd>Keep TrackCast running, check that the Browser Source URL matches the one in the Overlay module, and click "Add to OBS" again after changing the overlay port. With "When music is paused" set to Hide, the overlay only shows while a song plays.</dd><dt>OBS source does not update</dt><dd>Confirm the source name in OBS matches the one configured in the app exactly, including capitalization.</dd><dt>OBS connection fails</dt><dd>Check that OBS WebSocket is enabled, the password matches, and Windows Firewall is not blocking port 4455.</dd><dt>Spotify authorization fails</dt><dd>Verify the redirect URI in your Spotify Developer dashboard is exactly <code>http://127.0.0.1:8888/callback</code>, no trailing slash.</dd><dt>"Token expired" keeps appearing</dt><dd>The app auto-refreshes tokens 5 minutes before expiry. If errors persist, go to Settings → Spotify and re-authorize.</dd><dt>App icon stays grey in tray</dt><dd>Polling is paused, no Spotify track is playing, or the Spotify connection dropped. Resume polling from the sidebar footer.</dd>',
    'help.logs.title': 'Logs & reporting bugs',
    'help.logs.body': 'Detailed logs are stored at <code>%APPDATA%\\TrackCast\\logs\\main.log</code>. Include the last 100 lines when reporting an issue on GitHub.',
  },
  es: {
    'help.title': 'Ayuda y guía de configuración',
    'help.lede': 'Todo lo que necesitás para que TrackCast funcione con Spotify y OBS.',
    'help.quickstart.title': 'Inicio rápido',
    'help.quickstart.body': '<li>Creá una app gratis en Spotify Developer y copiá su Client ID y Secret.</li><li>Activá OBS WebSocket (menú Tools dentro de OBS Studio).</li><li>Ejecutá esta app y seguí el wizard. Listo.</li>',
    'help.spotify.title': 'Paso 1 · Crear una app en Spotify Developer',
    'help.spotify.body': '<li>Andá a <strong>developer.spotify.com/dashboard</strong> e iniciá sesión con tu cuenta de Spotify.</li><li>Hacé clic en <strong>Create app</strong>. Nombre y descripción pueden ser cualquier cosa.</li><li>En <strong>Redirect URIs</strong> agregá exactamente: <code>http://127.0.0.1:8888/callback</code></li><li>Guardá. Abrí la app y entrá en <strong>Settings</strong> para copiar Client ID y Client Secret.</li>',
    'help.obs.title': 'Paso 2 · Habilitar OBS WebSocket',
    'help.obs.body': '<li>Abrí OBS Studio.</li><li>Menú superior: <strong>Tools → WebSocket Server Settings</strong>.</li><li>Marcá <strong>Enable WebSocket server</strong>.</li><li>Definí un password de servidor y anotalo. El puerto por defecto es <code>4455</code>.</li><li>Clic en OK.</li>',
    'help.source.title': 'Paso 3 · Agregar el overlay a OBS',
    'help.source.body': 'En el paso 3 del wizard, o en el módulo Overlay, elegí Browser overlay, un layout y hacé clic en "Add to OBS". TrackCast crea un browser source "TrackCast Overlay" en la escena actual que cubre todo el lienzo, así que no hace falta redimensionarlo. ¿Preferís texto plano? Elegí Text source y hacé clic en "Check or create it in OBS".',
    'help.format.title': 'Personalizar el texto del overlay',
    'help.format.intro': 'El campo de formato acepta dos placeholders:',
    'help.format.list': '<li><code>{trackName}</code> &mdash; título del track actual</li><li><code>{artistName}</code> &mdash; artista o artistas separados por coma</li>',
    'help.format.example': 'Ejemplo: <code>♫ {trackName} por {artistName}</code>',
    'help.troubleshoot.title': 'Solución de problemas',
    'help.troubleshoot.body': '<dt>El overlay no aparece en OBS</dt><dd>Dejá TrackCast abierto, verificá que la URL del Browser Source coincida con la del módulo Overlay y hacé clic en "Add to OBS" otra vez si cambiaste el puerto. Con "When music is paused" en Hide, el overlay solo se ve mientras suena una canción.</dd><dt>El source de OBS no se actualiza</dt><dd>Confirmá que el nombre del source en OBS coincide exactamente con el configurado en la app, mayúsculas incluidas.</dd><dt>Falla la conexión a OBS</dt><dd>Verificá que OBS WebSocket esté habilitado, que el password coincida, y que el Firewall de Windows no esté bloqueando el puerto 4455.</dd><dt>Falla la autorización de Spotify</dt><dd>Verificá que el redirect URI en tu Spotify Developer dashboard sea exactamente <code>http://127.0.0.1:8888/callback</code>, sin slash al final.</dd><dt>Aparece "Token expired" todo el tiempo</dt><dd>La app refresca tokens automáticamente 5 minutos antes de que expiren. Si persiste, andá a Settings → Spotify y re-autorizá.</dd><dt>El ícono del tray queda gris</dt><dd>El polling está pausado, no hay track sonando en Spotify, o se cayó la conexión. Reanudá el polling desde el footer del sidebar.</dd>',
    'help.logs.title': 'Logs y reportar bugs',
    'help.logs.body': 'Los logs detallados están en <code>%APPDATA%\\TrackCast\\logs\\main.log</code>. Adjuntá las últimas 100 líneas cuando reportes un bug en GitHub.',
  },
};

function getInitialHelpLang() {
  const stored = localStorage.getItem('help.lang');
  if (stored === 'en' || stored === 'es') return stored;
  const sys = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return sys === 'es' ? 'es' : 'en';
}

function applyHelpLanguage(lang) {
  const dict = HELP_I18N[lang] || HELP_I18N.en;
  document.querySelectorAll('#view-help [data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const value = dict[key];
    if (value === undefined) return;
    if (el.tagName === 'OL' || el.tagName === 'UL' || el.tagName === 'DL') {
      el.innerHTML = value;
    } else {
      el.innerHTML = value;
    }
  });
  document.querySelectorAll('.help__lang-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.lang === lang);
    btn.setAttribute('aria-selected', btn.dataset.lang === lang ? 'true' : 'false');
  });
  localStorage.setItem('help.lang', lang);
}

function setupHelpLanguageToggle() {
  document.querySelectorAll('.help__lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyHelpLanguage(btn.dataset.lang));
  });
  applyHelpLanguage(getInitialHelpLang());
}

function setupSidebarListeners() {
  document.querySelectorAll('.sidebar__item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) showView(view);
    });
  });

  document.getElementById('btn-status-fix').addEventListener('click', () => {
    showView('overlay');
    selectEditorTab(document.getElementById('tab-text-content'));
    document.getElementById('app-main').scrollTop = 0;
  });

  const pollingBtn = document.getElementById('btn-sidebar-polling');
  if (pollingBtn) {
    pollingBtn.addEventListener('click', async () => {
      const enabled = await window.api.togglePolling();
      updatePollingLabel(enabled);
    });
  }
}

const STATUS_LABELS = {
  spotify: { ok: 'Playing', idle: 'Waiting', error: 'Error' },
  obs: { ok: 'Connected', idle: 'Waiting', error: 'Offline' },
};

function updatePollingLabel(enabled) {
  isPollingEnabled = enabled;
  const btn = document.getElementById('btn-sidebar-polling');
  const label = document.getElementById('sidebar-polling-label');
  if (!btn || !label) return;
  btn.setAttribute('aria-checked', String(enabled));
  label.textContent = enabled ? 'Tracking on' : 'Tracking paused';
  updateStatusSummary();
}

function updateFooterStatus(service, state) {
  let normalized = 'idle';
  if (state === 'ok' || state === 'connected' || state === 'playing') normalized = 'ok';
  else if (state === 'error') normalized = 'error';
  connectionState[service] = normalized;

  const root = document.getElementById(`footer-${service}`);
  if (!root) return;
  const dot = root.querySelector('.status-dot');
  dot.classList.remove('status-dot--idle', 'status-dot--ok', 'status-dot--error');
  dot.classList.add(`status-dot--${normalized}`);
  document.getElementById(`footer-${service}-state`).textContent = STATUS_LABELS[service][normalized];
  updateStatusSummary();
}

function updateStatusSummary() {
  const summary = document.getElementById('status-summary');
  if (!summary) return;

  let text = 'Ready to track';
  if (!isPollingEnabled) text = 'Tracking paused';
  else if (connectionState.spotify === 'error') text = 'Spotify needs attention';
  else if (connectionState.obs === 'error') text = 'OBS is offline';
  else if (connectionState.textSourceError) text = 'Text source needs attention';
  else if (connectionState.spotify === 'ok' && connectionState.obs === 'ok') text = 'Live on OBS';

  if (summary.textContent !== text) summary.textContent = text;

  const fix = document.getElementById('btn-status-fix');
  if (fix) {
    fix.hidden = !connectionState.textSourceError || connectionState.obs !== 'ok';
    fix.title = connectionState.textSourceError || '';
    document.getElementById('status-fix-text').textContent = /no text source named/i.test(connectionState.textSourceError || '')
      ? 'Text source not found'
      : 'Text source error';
  }
}

// ─────────────────────────────────────────────────────────────
// Wizard Setup
// ─────────────────────────────────────────────────────────────

function setupWizardListeners() {
  // Welcome
  document.getElementById('btn-start-setup').addEventListener('click', () => {
    showStep('spotify');
  });

  // Spotify step
  document.getElementById('btn-open-spotify-dev').addEventListener('click', () => {
    window.api.openExternal(SPOTIFY_DASHBOARD_URL);
  });

  document.getElementById('btn-spotify-back').addEventListener('click', () => {
    showStep('welcome');
  });

  ['spotify-client-id', 'spotify-client-secret'].forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener('input', checkSpotifyCredentials);
    input.addEventListener('blur', () => validateCredentialInput(input));
  });

  document.getElementById('btn-authorize-spotify').addEventListener('click', startSpotifyAuth);

  document.getElementById('btn-spotify-next').addEventListener('click', () => {
    showStep('obs');
  });

  // OBS step
  document.getElementById('btn-obs-back').addEventListener('click', () => {
    showStep('spotify');
  });

  document.getElementById('btn-test-obs').addEventListener('click', testOBSConnection);

  document.getElementById('btn-obs-next').addEventListener('click', () => {
    saveOBSConfig();
    showStep('overlay');
  });

  // Overlay step
  document.getElementById('btn-overlay-back').addEventListener('click', () => {
    showStep('obs');
  });

  document.getElementById('btn-overlay-next').addEventListener('click', async () => {
    applyOverlayEditorToConfig(config);
    await window.api.saveConfig(config);
    showStep('behavior');
  });

  // Behavior step
  document.getElementById('btn-behavior-back').addEventListener('click', () => {
    showStep('overlay');
  });

  document.getElementById('polling-interval').addEventListener('input', (e) => {
    updateIntervalDisplay('polling-interval-display', parseInt(e.target.value, 10));
  });

  document.getElementById('btn-behavior-next').addEventListener('click', async () => {
    saveBehaviorConfig();
    await finishSetup();
    showStep('complete');
    window.api.startPolling();
  });

  // Complete step
  document.getElementById('btn-toggle-polling').addEventListener('click', async () => {
    isPollingEnabled = await window.api.togglePolling();
    updatePollingButton();
  });

  document.getElementById('btn-open-settings').addEventListener('click', openAppShell);

  document.getElementById('btn-minimize-to-tray').addEventListener('click', () => {
    window.close();
  });

  // Initialize values from config
  initSpotifyStep();
  initOBSStep();
  initOverlayStep();
  initBehaviorStep();
}

function initSpotifyStep() {
  document.getElementById('copy-app-name').textContent = SPOTIFY_APP_NAME;
  document.getElementById('copy-app-description').textContent = SPOTIFY_APP_DESCRIPTION;
  document.getElementById('copy-website').textContent = PROJECT_URL;
  document.getElementById('spotify-redirect-uri').textContent = config.spotify.redirectUri;
  document.getElementById('spotify-client-id').value = config.spotify.clientId || '';
  document.getElementById('spotify-client-secret').value = config.spotify.clientSecret || '';
  validateCredentialInput(document.getElementById('spotify-client-id'));
  validateCredentialInput(document.getElementById('spotify-client-secret'));
  checkSpotifyCredentials();
}

function initOBSStep() {
  document.getElementById('obs-host').value = config.obs.host;
  document.getElementById('obs-port').value = config.obs.port;
  document.getElementById('obs-password').value = config.obs.password;
}

function initOverlayStep() {
  setupOverlayEditor();
  mountOverlayEditor('wizard-overlay-slot', 'wizard');
  loadOverlayEditor();
}

function initBehaviorStep() {
  document.getElementById('polling-interval').value = config.polling.intervalMs;
  updateIntervalDisplay('polling-interval-display', config.polling.intervalMs);
  document.getElementById('behavior-start-minimized').checked = config.behavior.startMinimized;
  document.getElementById('behavior-minimize-to-tray').checked = config.behavior.minimizeToTray;
  document.getElementById('behavior-auto-reconnect').checked = config.behavior.autoReconnect;
  document.getElementById('behavior-auto-start').checked = config.behavior.autoStartWithWindows || false;
}

// ─────────────────────────────────────────────────────────────
// Config Saving
// ─────────────────────────────────────────────────────────────

function saveOBSConfig() {
  config.obs.host = document.getElementById('obs-host').value;
  config.obs.port = parseInt(document.getElementById('obs-port').value, 10);
  config.obs.password = document.getElementById('obs-password').value;
}

function saveBehaviorConfig() {
  config.polling.intervalMs = parseInt(document.getElementById('polling-interval').value, 10);
  config.behavior.startMinimized = document.getElementById('behavior-start-minimized').checked;
  config.behavior.minimizeToTray = document.getElementById('behavior-minimize-to-tray').checked;
  config.behavior.autoReconnect = document.getElementById('behavior-auto-reconnect').checked;
  config.behavior.autoStartWithWindows = document.getElementById('behavior-auto-start').checked;

  // Apply auto-launch setting immediately
  window.api.setAutoLaunch(config.behavior.autoStartWithWindows);
}

async function finishSetup() {
  // Save Spotify credentials
  config.spotify.clientId = document.getElementById('spotify-client-id').value.trim();
  config.spotify.clientSecret = document.getElementById('spotify-client-secret').value.trim();

  config.setup.completed = true;
  
  await window.api.saveConfig(config);
}

// ─────────────────────────────────────────────────────────────
// Credential validation
// ─────────────────────────────────────────────────────────────

function isValidCredential(value) {
  return SPOTIFY_CREDENTIAL_PATTERN.test(value.trim());
}

function credentialErrorMessage(value, label, source) {
  const prefix = source === 'clipboard' ? 'Your clipboard contains' : 'This is';
  if (URL_PATTERN.test(value.trim())) {
    return `${prefix} a URL, not a ${label}. Copy the ${label} from your app's Settings in the Spotify Dashboard.`;
  }
  if (source === 'clipboard') {
    return `Your clipboard doesn't contain a ${label}. Copy it from your app's Settings in the Spotify Dashboard.`;
  }
  return `A ${label} is 32 letters and numbers. Copy it from your app's Settings in the Spotify Dashboard.`;
}

function setFieldError(input, message) {
  const error = document.getElementById(`${input.id}-error`);
  const group = input.closest('.input-group');
  if (error) error.textContent = message;
  if (group) group.classList.toggle('is-invalid', Boolean(message));
  input.setAttribute('aria-invalid', String(Boolean(message)));
}

// Shows an error for a non-empty invalid credential; returns true when the field is valid.
function validateCredentialInput(input) {
  const value = input.value.trim();
  if (!value) {
    setFieldError(input, '');
    return false;
  }
  const valid = isValidCredential(value);
  setFieldError(input, valid ? '' : credentialErrorMessage(value, input.dataset.credential, 'field'));
  return valid;
}

function checkSpotifyCredentials() {
  const idInput = document.getElementById('spotify-client-id');
  const secretInput = document.getElementById('spotify-client-secret');
  [idInput, secretInput].forEach((input) => {
    if (isValidCredential(input.value)) setFieldError(input, '');
  });
  const hasCredentials = isValidCredential(idInput.value) && isValidCredential(secretInput.value);
  const isAuthorized = Boolean(config.spotify.refreshToken);
  const authorizeBtn = document.getElementById('btn-authorize-spotify');

  authorizeBtn.disabled = !hasCredentials;
  authorizeBtn.textContent = isAuthorized ? 'Authorize again' : 'Authorize with Spotify';
  document.getElementById('btn-spotify-next').disabled = !isAuthorized;
  document.getElementById('spotify-auth-section').hidden = !isAuthorized;
}

// ─────────────────────────────────────────────────────────────
// Spotify Auth
// ─────────────────────────────────────────────────────────────

function setAuthStatus(statusEl, message, state) {
  statusEl.textContent = message;
  statusEl.className = state ? `auth-status-text ${state}` : 'auth-status-text';
}

async function runSpotifyAuthorization(credentials, statusEl, button) {
  setAuthStatus(statusEl, 'Waiting for authorization. Approve TrackCast in the browser window that just opened.');
  if (button) button.disabled = true;

  try {
    const result = await window.api.authorizeSpotify(credentials);
    if (!result.success) {
      setAuthStatus(statusEl, `Authorization failed: ${result.error}`, 'error');
      return false;
    }
    config = result.config;
    setAuthStatus(statusEl, 'Authorization successful!', 'success');
    return true;
  } catch (error) {
    setAuthStatus(statusEl, `Authorization failed: ${error.message}`, 'error');
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

async function startSpotifyAuth() {
  const authorized = await runSpotifyAuthorization(
    {
      clientId: document.getElementById('spotify-client-id').value.trim(),
      clientSecret: document.getElementById('spotify-client-secret').value.trim(),
      redirectUri: config.spotify.redirectUri,
    },
    document.getElementById('auth-status'),
    document.getElementById('btn-authorize-spotify'),
  );
  if (authorized) setAuthStatus(document.getElementById('auth-status'), '');
  checkSpotifyCredentials();
}

async function startSettingsSpotifyAuth() {
  const idValid = validateCredentialInput(document.getElementById('settings-spotify-client-id'));
  const secretValid = validateCredentialInput(document.getElementById('settings-spotify-client-secret'));
  if (!idValid || !secretValid) {
    setAuthStatus(document.getElementById('settings-auth-status'), 'Fix the Client ID and Client secret before authorizing.', 'error');
    return;
  }

  const authorized = await runSpotifyAuthorization(
    {
      clientId: document.getElementById('settings-spotify-client-id').value.trim(),
      clientSecret: document.getElementById('settings-spotify-client-secret').value.trim(),
      redirectUri: document.getElementById('settings-spotify-redirect-uri').value.trim(),
    },
    document.getElementById('settings-auth-status'),
    document.getElementById('btn-reauthorize-spotify'),
  );
  if (authorized) renderRedirectUriNotice();
}

// ─────────────────────────────────────────────────────────────
// Redirect URI migration notice
// ─────────────────────────────────────────────────────────────

function renderRedirectUriNotice() {
  const notice = document.getElementById('redirect-uri-notice');
  if (!notice) return;
  notice.hidden = !config.spotify.redirectUriMigrated;
  document.getElementById('notice-redirect-uri').textContent = config.spotify.redirectUri;
}

function showCopiedFeedback(button) {
  const label = button.querySelector('.copy-btn__label') || button;
  if (!button.dataset.label) button.dataset.label = label.textContent;
  clearTimeout(Number(button.dataset.resetTimer));
  label.textContent = 'Copied';
  button.classList.add('is-copied');
  announce('Copied to clipboard');
  button.dataset.resetTimer = String(setTimeout(() => {
    label.textContent = button.dataset.label;
    button.classList.remove('is-copied');
  }, COPY_FEEDBACK_MS));
}

function announce(message) {
  const announcer = document.getElementById('copy-announcer');
  if (!announcer) return;
  announcer.textContent = '';
  requestAnimationFrame(() => { announcer.textContent = message; });
}

// Copy, paste and show/hide buttons are declared in markup through data attributes.
function setupFieldHelpers() {
  document.addEventListener('click', async (event) => {
    const copyBtn = event.target.closest('[data-copy-target], [data-copy-input]');
    if (copyBtn) {
      const text = copyBtn.dataset.copyTarget
        ? document.getElementById(copyBtn.dataset.copyTarget).textContent
        : document.getElementById(copyBtn.dataset.copyInput).value;
      await window.api.copyText(text.trim());
      showCopiedFeedback(copyBtn);
      return;
    }

    const pasteBtn = event.target.closest('[data-paste-target]');
    if (pasteBtn) {
      const input = document.getElementById(pasteBtn.dataset.pasteTarget);
      const text = (await window.api.readClipboardText()).trim();
      if (!text) {
        if (input.dataset.credential) setFieldError(input, `Your clipboard is empty. Copy the ${input.dataset.credential} first.`);
        announce('Clipboard is empty');
        return;
      }
      if (input.dataset.credential && !isValidCredential(text)) {
        setFieldError(input, credentialErrorMessage(text, input.dataset.credential, 'clipboard'));
        input.focus();
        return;
      }
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      announce('Pasted from clipboard');
      return;
    }

    const revealBtn = event.target.closest('[data-reveal-target]');
    if (revealBtn) {
      const input = document.getElementById(revealBtn.dataset.revealTarget);
      const reveal = input.type === 'password';
      const label = revealBtn.getAttribute('aria-label');
      input.type = reveal ? 'text' : 'password';
      revealBtn.setAttribute('aria-pressed', String(reveal));
      revealBtn.setAttribute('aria-label', reveal ? label.replace('Show', 'Hide') : label.replace('Hide', 'Show'));
    }
  });
}

function setupRedirectUriNotice() {
  const copyBtn = document.getElementById('btn-notice-copy-uri');
  const reauthBtn = document.getElementById('btn-notice-reauthorize');

  copyBtn.addEventListener('click', async () => {
    await window.api.copyText(config.spotify.redirectUri);
    showCopiedFeedback(copyBtn);
  });

  document.getElementById('btn-notice-open-dashboard').addEventListener('click', () => {
    window.api.openExternal(SPOTIFY_DASHBOARD_URL);
  });

  reauthBtn.addEventListener('click', async () => {
    const authorized = await runSpotifyAuthorization(
      {
        clientId: config.spotify.clientId,
        clientSecret: config.spotify.clientSecret,
        redirectUri: config.spotify.redirectUri,
      },
      document.getElementById('notice-auth-status'),
      reauthBtn,
    );
    if (authorized) renderRedirectUriNotice();
  });

  document.getElementById('btn-notice-dismiss').addEventListener('click', async () => {
    config.spotify.redirectUriMigrated = false;
    await window.api.saveConfig(config);
    renderRedirectUriNotice();
  });

  renderRedirectUriNotice();
}

// ─────────────────────────────────────────────────────────────
// OBS Connection
// ─────────────────────────────────────────────────────────────

async function testOBSConnection() {
  const resultEl = document.getElementById('obs-test-result');
  const btn = document.getElementById('btn-test-obs');
  
  // Save current values first
  saveOBSConfig();
  await window.api.saveConfig(config);
  
  btn.disabled = true;
  btn.textContent = 'Testing…';
  resultEl.textContent = '';
  resultEl.className = 'test-result';

  try {
    const result = await window.api.testOBSConnection();
    
    if (result.success) {
      resultEl.textContent = 'Connected!';
      resultEl.className = 'test-result success';
    } else {
      resultEl.textContent = 'Failed: ' + result.error;
      resultEl.className = 'test-result error';
    }
  } catch (error) {
    resultEl.textContent = 'Error: ' + error.message;
    resultEl.className = 'test-result error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test connection';
  }
}

// ─────────────────────────────────────────────────────────────
// OBS Text source check + auto-create
// ─────────────────────────────────────────────────────────────


async function handleSourceCheck() {
  const btn = document.getElementById('btn-check-source');
  const result = document.getElementById('source-result');
  const nameInput = document.getElementById('obs-source-name');
  const sourceName = (nameInput?.value || '').trim();

  if (!sourceName) {
    renderSourceResult({ error: 'Enter a source name first.' });
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Checking…';
  renderSourceResult(null);

  const response = await window.api.obsCheckSource(sourceName);
  btn.disabled = false;
  btn.textContent = 'Check or create it in OBS';

  renderSourceResult(response, sourceName);
}

function renderSourceResult(data, sourceName) {
  const result = document.getElementById('source-result');
  if (!result) return;

  if (data === null) {
    result.hidden = true;
    result.innerHTML = '';
    return;
  }

  result.hidden = false;

  if (data.error) {
    result.className = 'source-result source-result--error';
    result.innerHTML = `<div class="source-result__row">${escapeHtml(data.error)}</div>`;
    return;
  }

  if (data.exists) {
    result.className = 'source-result source-result--ok';
    const scene = data.sceneName ? ` in scene <strong>${escapeHtml(data.sceneName)}</strong>` : '';
    result.innerHTML = `<div class="source-result__row">Source found${scene}. You're ready.</div>`;
    return;
  }

  if (data.suggestion) {
    result.className = 'source-result source-result--warn';
    result.innerHTML = `
      <div class="source-result__row">
        Not found. Did you mean <strong>${escapeHtml(data.suggestion)}</strong>?
      </div>
      <div class="source-result__action">
        <button class="btn btn--secondary btn--sm" id="btn-use-suggestion" type="button">Use this name</button>
        <button class="btn btn--ghost btn--sm" id="btn-create-source" type="button">Create new source</button>
      </div>
    `;
    document.getElementById('btn-use-suggestion')?.addEventListener('click', () => {
      const nameInput = document.getElementById('obs-source-name');
      if (nameInput) nameInput.value = data.suggestion;
      handleSourceCheck();
    });
    document.getElementById('btn-create-source')?.addEventListener('click', () => handleSourceCreate(sourceName));
    return;
  }

  result.className = 'source-result source-result--miss';
  result.innerHTML = `
    <div class="source-result__row">
      No source named <strong>${escapeHtml(sourceName)}</strong> in OBS.
    </div>
    <div class="source-result__action">
      <button class="btn btn--secondary btn--sm" id="btn-create-source" type="button">Create it for me</button>
    </div>
  `;
  document.getElementById('btn-create-source')?.addEventListener('click', () => handleSourceCreate(sourceName));
}

async function handleSourceCreate(sourceName) {
  const btn = document.getElementById('btn-create-source');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  // Save the chosen output mode and text style so OBS gets them and starts receiving updates.
  await persistOverlayEditor();
  const response = await window.api.obsCreateSource(sourceName);
  if (btn) { btn.disabled = false; }

  if (response.error) {
    renderSourceResult({ error: response.error });
    return;
  }
  renderSourceResult({ exists: true, sceneName: response.sceneName }, sourceName);
}

// ─────────────────────────────────────────────────────────────
// Overlay Preview
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
// Overlay editor (shared by wizard step 3 and the Overlay module)
// ─────────────────────────────────────────────────────────────

const OVERLAY_CANVAS_WIDTH = 1920;
const OVERLAY_CANVAS_HEIGHT = 1080;
const OVERLAY_STYLE_MESSAGE = 'trackcast:overlay-style';
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const THEME_NAME_MAX = 40;
// OBS Text (GDI+) has no color emoji support; ♪ exists in the Windows UI fonts.
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const VARIATION_SELECTOR_PATTERN = /\uFE0F/g;
const TEXT_NOTE_SYMBOL = '\u266a';
const SAMPLE_TRACK = { title: 'Bad Habit', artist: 'Steve Lacy' };
const {
  OVERLAY_FONTS, OVERLAY_THEME_KEYS, OVERLAY_THEMES, TEXT_THEME_KEYS, TEXT_THEMES, TEXT_FACES,
} = window.TrackCastThemes;

const EDITOR_TAB_STORAGE_KEY = 'overlay.editorTab';
const PREVIEW_ZOOM = 2.4;
let overlayEditorReady = false;
let previewZoomed = false;
let overlayStatus = null;
let overlayDirty = false;
let editorLoading = false;
let activeOverlayTheme = null;
let activeTextTheme = null;

function byId(id) {
  return document.getElementById(id);
}

function checkedValue(name) {
  const input = document.querySelector(`input[name="${name}"]:checked`);
  return input ? input.value : null;
}

function setChecked(name, value) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = input.value === value;
  });
}

function safeHex(value, fallback) {
  return HEX_COLOR_PATTERN.test(value || '') ? value : fallback;
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function sameValues(a, b, keys) {
  return keys.every((key) => String(a[key]) === String(b[key]));
}

// escapeHtml() does not escape quotes; use this for attribute values.
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function newThemeId() {
  return `custom-${Date.now().toString(36)}`;
}

// ── In-app dialog ────────────────────────────────────────────

const appDialog = (() => {
  let resolver = null;
  let mode = 'confirm';

  function open({ title, message = '', label = '', value = '', confirmText = 'OK', danger = false, prompt = false }) {
    const dialog = byId('app-dialog');
    mode = prompt ? 'prompt' : 'confirm';
    byId('app-dialog-title').textContent = title;
    byId('app-dialog-message').textContent = message;
    byId('app-dialog-message').hidden = !message;
    byId('app-dialog-field').hidden = !prompt;
    byId('app-dialog-label').textContent = label;
    byId('app-dialog-input').value = value;
    byId('app-dialog-error').textContent = '';
    const confirm = byId('app-dialog-confirm');
    confirm.textContent = confirmText;
    confirm.classList.toggle('btn--danger', danger);
    confirm.classList.toggle('btn--primary', !danger);
    dialog.showModal();
    if (prompt) byId('app-dialog-input').select();
    else byId('app-dialog-cancel').focus();
    return new Promise((resolve) => { resolver = resolve; });
  }

  function close(result) {
    byId('app-dialog').close();
    if (resolver) resolver(result);
    resolver = null;
  }

  function setup() {
    byId('app-dialog-cancel').addEventListener('click', () => close(mode === 'prompt' ? null : false));
    byId('app-dialog').addEventListener('cancel', (event) => {
      event.preventDefault();
      close(mode === 'prompt' ? null : false);
    });
    byId('app-dialog-form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (mode === 'prompt') {
        const value = byId('app-dialog-input').value.trim();
        if (!value) {
          byId('app-dialog-error').textContent = 'Enter a name.';
          return;
        }
        close(value.slice(0, THEME_NAME_MAX));
      } else {
        close(true);
      }
    });
  }

  return {
    setup,
    confirm: (options) => open({ ...options, prompt: false }),
    prompt: (options) => open({ ...options, prompt: true }),
  };
})();

// ── Mounting and visibility ──────────────────────────────────

function mountOverlayEditor(slotId, context) {
  const editor = byId('overlay-editor');
  const slot = byId(slotId);
  if (!editor || !slot) return;
  if (editor.parentElement !== slot) slot.appendChild(editor);
  editor.dataset.context = context;
  updateEditorVisibility();
}

function readStoredEditorTab() {
  try {
    return localStorage.getItem(EDITOR_TAB_STORAGE_KEY);
  } catch {
    return null;
  }
}

function selectEditorTab(tab, { remember = true } = {}) {
  if (!tab) return;
  document.querySelectorAll('[data-editor-tab]').forEach((button) => {
    const selected = button === tab;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  if (remember) {
    try { localStorage.setItem(EDITOR_TAB_STORAGE_KEY, tab.id); } catch { /* storage unavailable */ }
  }
  updateEditorVisibility();
}

// Shows the preview, tabs and panels that match the output mode.
// In the Overlay module one tab is visible at a time; the wizard shows every relevant panel stacked.
function updateEditorVisibility() {
  const editor = byId('overlay-editor');
  const mode = checkedValue('output-mode') || 'overlay';
  const inModule = editor.dataset.context === 'module';
  editor.dataset.mode = mode;

  const tabs = [...document.querySelectorAll('[data-editor-tab]')];
  tabs.forEach((tab) => {
    tab.hidden = !tab.dataset.modes.split(' ').includes(mode);
    tab.textContent = mode === 'both' ? tab.dataset.labelBoth : tab.dataset.label;
  });

  let active = tabs.find((tab) => tab.classList.contains('is-active') && !tab.hidden);
  if (!active) {
    active = tabs.find((tab) => tab.id === readStoredEditorTab() && !tab.hidden) || tabs.find((tab) => !tab.hidden);
    tabs.forEach((tab) => {
      const selected = tab === active;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
  }

  editor.querySelectorAll('[data-modes]').forEach((element) => {
    if (element.matches('[data-editor-tab]')) return;
    const inMode = element.dataset.modes.split(' ').includes(mode);
    const isPanel = element.classList.contains('editor-panel');
    element.hidden = !inMode || (isPanel && inModule && element.id !== active?.dataset.editorTab);
  });

  byId('overlay-idle-field').hidden = byId('overlay-when-paused').value !== 'idle';
  byId('overlay-scale-value').textContent = `${Math.round(Number(byId('overlay-scale').value) * 100)}%`;
  byId('overlay-surface-opacity-value').textContent = `${Math.round(Number(byId('overlay-surface-opacity').value) * 100)}%`;
  byId('text-outline-size-value').textContent = byId('text-outline-size').value;
  byId('text-background-opacity-value').textContent = `${byId('text-background-opacity').value}%`;
  byId('text-opacity-value').textContent = `${byId('text-opacity').value}%`;
  byId('text-gradient-color').disabled = !byId('text-gradient-on').checked;
  byId('text-outline-color').disabled = !byId('text-outline-on').checked;
  byId('text-outline-size').disabled = !byId('text-outline-on').checked;
  fitOverlayPreview();
}

// ── Setup ────────────────────────────────────────────────────

function setupOverlayEditor() {
  if (overlayEditorReady) return;
  overlayEditorReady = true;

  appDialog.setup();

  byId('overlay-font').innerHTML = OVERLAY_FONTS
    .map((font) => `<option value="${font.id}">${escapeHtml(font.label)}</option>`).join('');
  byId('text-face').innerHTML = TEXT_FACES
    .map((face) => `<option value="${escapeAttr(face)}">${escapeHtml(face)}</option>`).join('');

  const editor = byId('overlay-editor');
  const onEdit = () => {
    if (editorLoading) return;
    updateEditorVisibility();
    updateOverlayPreview();
    sendOverlayPreviewStyle();
    refreshThemeSelection();
    markOverlayDirty();
  };
  editor.addEventListener('input', onEdit);
  editor.addEventListener('change', onEdit);

  document.querySelectorAll('[data-editor-tab]').forEach((tab) => {
    tab.addEventListener('click', () => selectEditorTab(tab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const visible = [...document.querySelectorAll('[data-editor-tab]')].filter((t) => !t.hidden);
      const index = visible.indexOf(tab);
      const next = visible[(index + (event.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
      selectEditorTab(next);
      next.focus();
    });
  });

  const zoomButton = byId('btn-preview-zoom');
  zoomButton.addEventListener('click', () => {
    previewZoomed = !previewZoomed;
    zoomButton.setAttribute('aria-pressed', String(previewZoomed));
    zoomButton.classList.toggle('is-active', previewZoomed);
    fitOverlayPreview();
  });

  byId('overlay-preview-frame').addEventListener('load', sendOverlayPreviewStyle);
  byId('btn-add-overlay').addEventListener('click', addOverlayToObs);
  byId('btn-check-source').addEventListener('click', handleSourceCheck);
  byId('btn-replace-emoji').addEventListener('click', () => {
    const input = byId('overlay-format');
    input.value = input.value.replace(EMOJI_PATTERN, TEXT_NOTE_SYMBOL).replace(VARIATION_SELECTOR_PATTERN, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  byId('btn-save-overlay-theme').addEventListener('click', () => saveCurrentAsTheme('overlay'));
  byId('btn-save-text-theme').addEventListener('click', () => saveCurrentAsTheme('text'));
  byId('btn-overlay-save').addEventListener('click', saveOverlayModule);
  byId('btn-overlay-discard').addEventListener('click', discardOverlayChanges);

  new ResizeObserver(() => fitOverlayPreview()).observe(byId('overlay-preview-canvas'));
}

// ── Load / collect ───────────────────────────────────────────

function loadOverlayEditor() {
  editorLoading = true;
  const overlay = config.browserOverlay;
  const textStyle = config.overlay.textStyle;

  setChecked('output-mode', config.obs.outputMode || 'overlay');
  setChecked('overlay-layout', overlay.layout);
  setChecked('overlay-corner', overlay.corner);
  byId('overlay-animation').value = overlay.animation;
  byId('overlay-scale').value = overlay.scale;
  applyOverlayThemeStyleToControls(overlay);
  byId('overlay-show-art').checked = overlay.showAlbumArt;
  byId('overlay-show-artist').checked = overlay.showArtist;
  byId('overlay-show-album').checked = overlay.showAlbum;
  byId('overlay-show-progress').checked = overlay.showProgress;
  byId('overlay-label-playing').value = overlay.labels.nowPlaying;
  byId('overlay-label-paused').value = overlay.labels.paused;
  byId('overlay-when-paused').value = overlay.whenPaused;
  byId('overlay-idle-message').value = overlay.idleMessage;
  byId('overlay-port').value = overlay.port;

  byId('obs-source-name').value = config.obs.textSourceName;
  byId('overlay-format').value = config.overlay.format;
  byId('overlay-idle-text').value = config.overlay.idleText;
  byId('overlay-show-only-playing').checked = config.overlay.showOnlyWhenPlaying;
  byId('text-size').value = textStyle.size;
  applyTextThemeStyleToControls(textStyle);

  activeOverlayTheme = overlay.theme || null;
  activeTextTheme = config.overlay.textTheme || null;
  editorLoading = false;

  updateEditorVisibility();
  renderThemeGalleries();
  updateOverlayPreview();
  setOverlayDirty(false);
  refreshOverlayStatus();
}

function applyOverlayThemeStyleToControls(style) {
  byId('overlay-accent').value = safeHex(style.accent, '#30e07a');
  byId('overlay-accent2').value = safeHex(style.accent2, style.accent);
  byId('overlay-surface-color').value = safeHex(style.surfaceColor, '#0c100e');
  byId('overlay-surface-opacity').value = style.surfaceOpacity;
  byId('overlay-text-color').value = safeHex(style.textColor, '#f4f7f5');
  byId('overlay-font').value = style.font;
  byId('overlay-border').value = style.border;
  byId('overlay-effect').value = style.effect;
  setChecked('overlay-radius', style.radius);
  byId('overlay-uppercase').checked = Boolean(style.uppercaseTitle);
}

function applyTextThemeStyleToControls(style) {
  byId('text-face').value = style.face;
  byId('text-bold').checked = style.bold;
  byId('text-italic').checked = style.italic;
  byId('text-uppercase').checked = style.uppercase;
  byId('text-color').value = safeHex(style.color, '#ffffff');
  byId('text-opacity').value = style.opacity;
  byId('text-gradient-on').checked = Boolean(style.gradientColor);
  byId('text-gradient-color').value = safeHex(style.gradientColor, '#ff8a00');
  byId('text-outline-on').checked = Boolean(style.outlineColor && style.outlineSize > 0);
  byId('text-outline-color').value = safeHex(style.outlineColor, '#000000');
  byId('text-outline-size').value = style.outlineSize || 3;
  byId('text-background-color').value = safeHex(style.backgroundColor, '#000000');
  byId('text-background-opacity').value = style.backgroundOpacity;
}

function collectOverlayThemeStyle() {
  return {
    accent: byId('overlay-accent').value,
    accent2: byId('overlay-accent2').value,
    surfaceColor: byId('overlay-surface-color').value,
    surfaceOpacity: Number(byId('overlay-surface-opacity').value),
    textColor: byId('overlay-text-color').value,
    font: byId('overlay-font').value,
    radius: checkedValue('overlay-radius') || 'rounded',
    border: byId('overlay-border').value,
    effect: byId('overlay-effect').value,
    uppercaseTitle: byId('overlay-uppercase').checked,
  };
}

function collectTextThemeStyle() {
  const outlineOn = byId('text-outline-on').checked;
  return {
    face: byId('text-face').value,
    bold: byId('text-bold').checked,
    italic: byId('text-italic').checked,
    uppercase: byId('text-uppercase').checked,
    color: byId('text-color').value,
    opacity: Number(byId('text-opacity').value),
    gradientColor: byId('text-gradient-on').checked ? byId('text-gradient-color').value : null,
    outlineColor: outlineOn ? byId('text-outline-color').value : null,
    outlineSize: outlineOn ? Number(byId('text-outline-size').value) : 0,
    backgroundColor: byId('text-background-color').value,
    backgroundOpacity: Number(byId('text-background-opacity').value),
  };
}

function collectOverlayStyle() {
  const port = parseInt(byId('overlay-port').value, 10);
  return {
    port: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : config.browserOverlay.port,
    theme: activeOverlayTheme,
    layout: checkedValue('overlay-layout') || 'card',
    corner: checkedValue('overlay-corner') || 'bottom-left',
    animation: byId('overlay-animation').value,
    scale: Number(byId('overlay-scale').value),
    ...collectOverlayThemeStyle(),
    showAlbumArt: byId('overlay-show-art').checked,
    showArtist: byId('overlay-show-artist').checked,
    showAlbum: byId('overlay-show-album').checked,
    showProgress: byId('overlay-show-progress').checked,
    whenPaused: byId('overlay-when-paused').value,
    idleMessage: byId('overlay-idle-message').value.trim(),
    labels: {
      nowPlaying: byId('overlay-label-playing').value.trim(),
      paused: byId('overlay-label-paused').value.trim(),
    },
  };
}

function applyOverlayEditorToConfig(target) {
  const textSize = parseInt(byId('text-size').value, 10);
  target.obs.outputMode = checkedValue('output-mode') || 'overlay';
  target.obs.textSourceName = byId('obs-source-name').value.trim();
  target.browserOverlay = collectOverlayStyle();
  target.overlay.format = byId('overlay-format').value;
  target.overlay.idleText = byId('overlay-idle-text').value;
  target.overlay.showOnlyWhenPlaying = byId('overlay-show-only-playing').checked;
  target.overlay.textTheme = activeTextTheme;
  target.overlay.textStyle = {
    ...collectTextThemeStyle(),
    size: Number.isInteger(textSize) && textSize >= 8 && textSize <= 400 ? textSize : config.overlay.textStyle.size,
  };
}

// ── Themes ───────────────────────────────────────────────────

function allThemes(kind) {
  const builtIn = kind === 'overlay' ? OVERLAY_THEMES : TEXT_THEMES;
  return [...builtIn, ...(config.customThemes?.[kind] || [])];
}

function findTheme(kind, id) {
  return allThemes(kind).find((theme) => theme.id === id) || null;
}

function isThemeModified(kind) {
  const id = kind === 'overlay' ? activeOverlayTheme : activeTextTheme;
  const theme = findTheme(kind, id);
  if (!theme) return false;
  return kind === 'overlay'
    ? !sameValues(theme.style, collectOverlayThemeStyle(), OVERLAY_THEME_KEYS)
    : !sameValues(theme.style, collectTextThemeStyle(), TEXT_THEME_KEYS);
}

function miniOverlayMarkup(style) {
  const font = OVERLAY_FONTS.find((f) => f.id === style.font) || OVERLAY_FONTS[0];
  const vars = [
    `--mini-accent:${style.accent}`,
    `--mini-accent2:${style.accent2}`,
    `--mini-surface:${hexToRgba(style.surfaceColor, style.surfaceOpacity)}`,
    `--mini-text:${style.textColor}`,
    `--mini-text-soft:${hexToRgba(style.textColor, 0.7)}`,
    `--mini-glow:${hexToRgba(style.accent, 0.45)}`,
    `--mini-title-font:${font.title}`,
    `--mini-body-font:${font.body}`,
  ].join(';');
  return `
    <span class="mini-overlay" style="${escapeAttr(vars)}" data-radius="${escapeAttr(style.radius)}" data-border="${escapeAttr(style.border)}" data-effect="${escapeAttr(style.effect)}" data-font="${escapeAttr(style.font)}" data-uppercase="${style.uppercaseTitle}">
      <span class="mini-overlay__art"><svg class="icon" aria-hidden="true"><use href="#i-note"/></svg></span>
      <span class="mini-overlay__body">
        <span class="mini-overlay__label">Now playing</span>
        <span class="mini-overlay__title">${SAMPLE_TRACK.title}</span>
        <span class="mini-overlay__artist">${SAMPLE_TRACK.artist}</span>
        <span class="mini-overlay__bar"><i></i></span>
      </span>
    </span>`;
}

function textSampleStyle(style, sizePx) {
  const parts = [
    `font-family:'${style.face}', 'Segoe UI', sans-serif`,
    `font-weight:${style.bold ? 700 : 400}`,
    `font-style:${style.italic ? 'italic' : 'normal'}`,
    `text-transform:${style.uppercase ? 'uppercase' : 'none'}`,
    `opacity:${style.opacity / 100}`,
    `background-color:${hexToRgba(style.backgroundColor, style.backgroundOpacity / 100)}`,
  ];
  if (sizePx) parts.push(`font-size:${sizePx}px`);
  if (style.gradientColor) {
    parts.push(`background-image:linear-gradient(180deg, ${style.color}, ${style.gradientColor})`, '-webkit-background-clip:text', 'color:transparent');
  } else {
    parts.push(`color:${style.color}`);
  }
  if (style.outlineColor && style.outlineSize > 0) {
    const width = Math.max(1, Math.round(Math.min(style.outlineSize, 8) * (sizePx ? 1 : 0.6)));
    if (style.gradientColor) {
      // A stroke would cover background-clipped gradient text, so draw the outline as shadows instead.
      const c = style.outlineColor;
      parts.push(`filter:drop-shadow(${width}px 0 0 ${c}) drop-shadow(-${width}px 0 0 ${c}) drop-shadow(0 ${width}px 0 ${c}) drop-shadow(0 -${width}px 0 ${c})`);
    } else {
      parts.push(`-webkit-text-stroke:${width}px ${style.outlineColor}`, 'paint-order:stroke fill');
    }
  }
  return parts.join(';');
}

function themeCardMarkup(kind, theme, { custom }) {
  const selectedId = kind === 'overlay' ? activeOverlayTheme : activeTextTheme;
  const selected = theme.id === selectedId;
  const modified = selected && isThemeModified(kind);
  const art = kind === 'overlay'
    ? `<span class="theme-card__stage">${miniOverlayMarkup(theme.style)}</span>`
    : `<span class="theme-card__stage theme-card__stage--text"><span class="text-sample" style="${escapeAttr(textSampleStyle(theme.style))}">${SAMPLE_TRACK.title}</span></span>`;
  const actions = custom ? `
      <span class="theme-card__actions">
        <button class="icon-btn icon-btn--sm" type="button" data-theme-action="rename" aria-label="Rename ${escapeAttr(theme.name)}" title="Rename"><svg class="icon" aria-hidden="true"><use href="#i-pencil"/></svg></button>
        <button class="icon-btn icon-btn--sm" type="button" data-theme-action="duplicate" aria-label="Duplicate ${escapeAttr(theme.name)}" title="Duplicate"><svg class="icon" aria-hidden="true"><use href="#i-duplicate"/></svg></button>
        <button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-theme-action="delete" aria-label="Delete ${escapeAttr(theme.name)}" title="Delete"><svg class="icon" aria-hidden="true"><use href="#i-trash"/></svg></button>
      </span>` : '';
  return `
    <div class="theme-card${selected ? ' is-selected' : ''}" data-theme-kind="${kind}" data-theme-id="${escapeAttr(theme.id)}">
      <button class="theme-card__apply" type="button" aria-pressed="${selected}" aria-label="Use the ${escapeAttr(theme.name)} theme">
        ${art}
        <span class="theme-card__meta">
          <span class="theme-card__name">${escapeHtml(theme.name)}${modified ? ' <span class="theme-card__badge">Modified</span>' : ''}</span>
          <span class="theme-card__vibe">${escapeHtml(theme.vibe || 'Custom theme')}</span>
        </span>
      </button>
      ${actions}
    </div>`;
}

function renderThemeGalleries() {
  const customOverlay = config.customThemes?.overlay || [];
  const customText = config.customThemes?.text || [];
  byId('overlay-theme-grid').innerHTML = OVERLAY_THEMES.map((t) => themeCardMarkup('overlay', t, { custom: false })).join('');
  byId('overlay-custom-grid').innerHTML = customOverlay.map((t) => themeCardMarkup('overlay', t, { custom: true })).join('');
  byId('overlay-custom-empty').hidden = customOverlay.length > 0;
  byId('text-theme-grid').innerHTML = TEXT_THEMES.map((t) => themeCardMarkup('text', t, { custom: false })).join('');
  byId('text-custom-grid').innerHTML = customText.map((t) => themeCardMarkup('text', t, { custom: true })).join('');
  byId('text-custom-empty').hidden = customText.length > 0;

  document.querySelectorAll('.theme-card').forEach((card) => {
    const { themeKind: kind, themeId: id } = card.dataset;
    card.querySelector('.theme-card__apply').addEventListener('click', () => applyTheme(kind, id));
    card.querySelectorAll('[data-theme-action]').forEach((button) => {
      button.addEventListener('click', () => handleThemeAction(kind, id, button.dataset.themeAction));
    });
  });
}

function refreshThemeSelection() {
  if (!overlayEditorReady) return;
  renderThemeGalleries();
}

function applyTheme(kind, id) {
  const theme = findTheme(kind, id);
  if (!theme) return;
  editorLoading = true;
  if (kind === 'overlay') {
    applyOverlayThemeStyleToControls(theme.style);
    activeOverlayTheme = id;
  } else {
    applyTextThemeStyleToControls(theme.style);
    activeTextTheme = id;
  }
  editorLoading = false;
  updateEditorVisibility();
  updateOverlayPreview();
  sendOverlayPreviewStyle();
  renderThemeGalleries();
  markOverlayDirty();
}

async function saveCurrentAsTheme(kind) {
  const base = findTheme(kind, kind === 'overlay' ? activeOverlayTheme : activeTextTheme);
  const name = await appDialog.prompt({
    title: kind === 'overlay' ? 'Save overlay theme' : 'Save text theme',
    label: 'Theme name',
    value: base ? `My ${base.name}` : 'My theme',
    confirmText: 'Save theme',
  });
  if (!name) return;

  const theme = {
    id: newThemeId(),
    name,
    style: kind === 'overlay' ? collectOverlayThemeStyle() : collectTextThemeStyle(),
  };
  config.customThemes[kind] = [...config.customThemes[kind], theme];
  if (kind === 'overlay') activeOverlayTheme = theme.id;
  else activeTextTheme = theme.id;
  await persistCustomThemes();
  renderThemeGalleries();
  markOverlayDirty();
}

async function handleThemeAction(kind, id, action) {
  const themes = config.customThemes[kind];
  const theme = themes.find((t) => t.id === id);
  if (!theme) return;

  if (action === 'rename') {
    const name = await appDialog.prompt({ title: 'Rename theme', label: 'Theme name', value: theme.name, confirmText: 'Rename' });
    if (!name) return;
    config.customThemes[kind] = themes.map((t) => (t.id === id ? { ...t, name } : t));
  } else if (action === 'duplicate') {
    config.customThemes[kind] = [...themes, { ...theme, id: newThemeId(), name: `${theme.name} copy`.slice(0, THEME_NAME_MAX) }];
  } else if (action === 'delete') {
    const confirmed = await appDialog.confirm({
      title: `Delete "${theme.name}"?`,
      message: 'This removes the saved theme. Your overlay keeps its current look.',
      confirmText: 'Delete theme',
      danger: true,
    });
    if (!confirmed) return;
    config.customThemes[kind] = themes.filter((t) => t.id !== id);
    if (kind === 'overlay' && activeOverlayTheme === id) activeOverlayTheme = null;
    if (kind === 'text' && activeTextTheme === id) activeTextTheme = null;
  }

  await persistCustomThemes();
  renderThemeGalleries();
}

// Saved themes are stored right away; the draft overlay style stays unsaved until "Save changes".
async function persistCustomThemes() {
  const saved = await window.api.getConfig();
  saved.customThemes = config.customThemes;
  await window.api.saveConfig(saved);
}

// ── Dirty state (Overlay module) ─────────────────────────────

function setOverlayDirty(dirty) {
  overlayDirty = dirty;
  const inModule = byId('overlay-editor').dataset.context === 'module';
  byId('overlay-savebar').hidden = !(dirty && inModule);
}

function markOverlayDirty() {
  setOverlayDirty(true);
}

async function persistOverlayEditor() {
  applyOverlayEditorToConfig(config);
  await window.api.saveConfig(config);
  setOverlayDirty(false);
  await refreshOverlayStatus();
}

async function saveOverlayModule() {
  const button = byId('btn-overlay-save');
  const status = byId('overlay-save-status');
  button.disabled = true;
  try {
    await persistOverlayEditor();
    status.textContent = '';
  } catch (error) {
    status.textContent = `Could not save: ${error.message}`;
    status.className = 'test-result error';
  } finally {
    button.disabled = false;
  }
}

function discardOverlayChanges() {
  loadOverlayEditor();
  sendOverlayPreviewStyle();
}

// ── Preview and OBS actions ──────────────────────────────────

const TEXT_PREVIEW_MAX_PX = 30;

function updateOverlayPreview() {
  const format = byId('overlay-format').value;
  const idleText = byId('overlay-idle-text').value;
  const showOnlyPlaying = byId('overlay-show-only-playing').checked;
  const sample = byId('preview-text');
  const size = Math.min(parseInt(byId('text-size').value, 10) || 42, TEXT_PREVIEW_MAX_PX);

  sample.textContent = showOnlyPlaying || !idleText
    ? format.replace('{trackName}', SAMPLE_TRACK.title).replace('{artistName}', SAMPLE_TRACK.artist)
    : idleText;
  sample.setAttribute('style', textSampleStyle(collectTextThemeStyle(), size));

  const hasEmoji = new RegExp(EMOJI_PATTERN.source, 'u').test(format) || new RegExp(EMOJI_PATTERN.source, 'u').test(idleText);
  byId('overlay-format-emoji').hidden = !hasEmoji;
}

function fitOverlayPreview() {
  const canvas = byId('overlay-preview-canvas');
  const frame = byId('overlay-preview-frame');
  const width = canvas.clientWidth;
  if (!width) return;

  const fitScale = width / OVERLAY_CANVAS_WIDTH;
  if (!previewZoomed) {
    frame.style.transform = `scale(${fitScale})`;
    return;
  }

  // Zoom toward the corner where the widget is anchored.
  const scale = fitScale * PREVIEW_ZOOM;
  const corner = checkedValue('overlay-corner') || 'bottom-left';
  const height = canvas.clientHeight;
  const x = corner.endsWith('right') ? width - OVERLAY_CANVAS_WIDTH * scale : 0;
  const y = corner.startsWith('bottom') ? height - OVERLAY_CANVAS_HEIGHT * scale : 0;
  frame.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

async function refreshOverlayStatus() {
  overlayStatus = await window.api.getOverlayStatus();
  const statusEl = byId('overlay-preview-status');
  const frame = byId('overlay-preview-frame');

  byId('overlay-url').textContent = overlayStatus.url || 'Not running';
  byId('btn-add-overlay').disabled = !overlayStatus.running;
  statusEl.hidden = !overlayStatus.error;
  statusEl.textContent = overlayStatus.error || '';

  const previewUrl = overlayStatus.url ? `${overlayStatus.url}?preview=1` : '';
  if (previewUrl && frame.getAttribute('src') !== previewUrl) {
    frame.setAttribute('src', previewUrl);
  } else if (!previewUrl) {
    frame.removeAttribute('src');
  }
  fitOverlayPreview();
}

function sendOverlayPreviewStyle() {
  const frame = byId('overlay-preview-frame');
  if (!overlayStatus?.url || !frame.contentWindow) return;
  const { port, ...style } = collectOverlayStyle();
  frame.contentWindow.postMessage({ type: OVERLAY_STYLE_MESSAGE, style }, new URL(overlayStatus.url).origin);
}

async function addOverlayToObs() {
  const button = byId('btn-add-overlay');
  const statusEl = byId('add-overlay-status');
  button.disabled = true;
  setAuthStatus(statusEl, 'Adding the overlay to OBS…');

  try {
    await persistOverlayEditor();
    const result = await window.api.addOverlayToOBS();
    if (!result.success) {
      setAuthStatus(statusEl, `Could not add the overlay: ${result.error}`, 'error');
    } else if (result.created) {
      setAuthStatus(statusEl, `Added "${result.sourceName}" to the scene "${result.sceneName}". It fills the whole canvas, so no resizing is needed.`, 'success');
    } else {
      const where = result.sceneName ? ` in the scene "${result.sceneName}"` : '';
      setAuthStatus(statusEl, `"${result.sourceName}" already exists${where}. Its URL and size were updated.`, 'success');
    }
  } finally {
    button.disabled = !overlayStatus?.running;
  }
}


// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────

function loadSettingsValues() {
  // Spotify
  document.getElementById('settings-spotify-client-id').value = config.spotify.clientId || '';
  document.getElementById('settings-spotify-client-secret').value = config.spotify.clientSecret || '';
  document.getElementById('settings-spotify-redirect-uri').value = config.spotify.redirectUri || '';
  
  // OBS
  document.getElementById('settings-obs-host').value = config.obs.host;
  document.getElementById('settings-obs-port').value = config.obs.port;
  document.getElementById('settings-obs-password').value = config.obs.password;
  
  // Overlay
  
  // Behavior
  document.getElementById('settings-polling-interval').value = config.polling.intervalMs;
  updateIntervalDisplay('settings-polling-display', config.polling.intervalMs);
  document.getElementById('settings-start-minimized').checked = config.behavior.startMinimized;
  document.getElementById('settings-minimize-to-tray').checked = config.behavior.minimizeToTray;
  document.getElementById('settings-auto-reconnect').checked = config.behavior.autoReconnect;
  document.getElementById('settings-auto-start').checked = config.behavior.autoStartWithWindows || false;
}

function setupSettingsListeners() {
  // Tabs
  const tabs = [...document.querySelectorAll('.tab-btn')];
  const selectTab = (btn) => {
    tabs.forEach((b) => {
      const selected = b === btn;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-selected', String(selected));
      b.tabIndex = selected ? 0 : -1;
      document.getElementById(b.dataset.tab).hidden = !selected;
    });
    document.getElementById('settings-footer').hidden = ['tab-about', 'tab-logs'].includes(btn.dataset.tab);
  };
  tabs.forEach((btn, index) => {
    btn.addEventListener('click', () => selectTab(btn));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const offset = e.key === 'ArrowRight' ? 1 : tabs.length - 1;
      const next = tabs[(index + offset) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });

  // Polling interval
  document.getElementById('settings-polling-interval').addEventListener('input', (e) => {
    updateIntervalDisplay('settings-polling-display', parseInt(e.target.value, 10));
  });

  // About
  window.api.getAppVersion().then((version) => {
    document.getElementById('app-version').textContent = version;
  });
  document.getElementById('btn-open-repo').addEventListener('click', () => {
    window.api.openExternal(PROJECT_URL);
  });

  // Test OBS
  document.getElementById('btn-test-obs-settings').addEventListener('click', async () => {
    // First save current settings
    await saveSettingsToConfig();
    
    const resultEl = document.getElementById('settings-obs-test-result');
    resultEl.textContent = 'Testing…';
    resultEl.className = 'test-result';
    
    try {
      const result = await window.api.testOBSConnection();
      if (result.success) {
        resultEl.textContent = 'Connected!';
        resultEl.className = 'test-result success';
      } else {
        resultEl.textContent = 'Failed: ' + result.error;
        resultEl.className = 'test-result error';
      }
    } catch (error) {
      resultEl.textContent = 'Error: ' + error.message;
      resultEl.className = 'test-result error';
    }
  });

  // Re-authorize Spotify
  document.getElementById('btn-reauthorize-spotify').addEventListener('click', startSettingsSpotifyAuth);
  ['settings-spotify-client-id', 'settings-spotify-client-secret'].forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener('blur', () => validateCredentialInput(input));
    input.addEventListener('input', () => {
      if (isValidCredential(input.value)) setFieldError(input, '');
    });
  });

  // Clear logs
  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    const logOutput = document.getElementById('log-output');
    logOutput.innerHTML = '';
  });

  // Setup updater listeners
  setupUpdaterListeners();

  // Save settings
  const saveBtn = document.getElementById('btn-save-settings');
  const saveStatus = document.getElementById('settings-save-status');
  saveBtn.addEventListener('click', async () => {
    const credentialInputs = ['settings-spotify-client-id', 'settings-spotify-client-secret']
      .map((id) => document.getElementById(id));
    const invalid = credentialInputs.filter((input) => input.value.trim() && !validateCredentialInput(input));
    if (invalid.length > 0) {
      document.getElementById('tabbtn-spotify').click();
      invalid[0].focus();
      saveStatus.textContent = 'Fix the Spotify credentials before saving.';
      saveStatus.className = 'test-result error';
      return;
    }

    saveBtn.disabled = true;
    try {
      await saveSettingsToConfig();

      // Restart polling with new interval
      if (config.polling.enabled) {
        await window.api.stopPolling();
        await window.api.startPolling();
      }
      await refreshOverlayStatus();
      saveStatus.textContent = 'Changes saved';
      saveStatus.className = 'test-result success';
    } catch (error) {
      saveStatus.textContent = `Could not save: ${error.message}`;
      saveStatus.className = 'test-result error';
    } finally {
      saveBtn.disabled = false;
      setTimeout(() => { saveStatus.textContent = ''; }, SAVE_FEEDBACK_MS);
    }
  });
}

async function saveSettingsToConfig() {
  // Spotify
  config.spotify.clientId = document.getElementById('settings-spotify-client-id').value.trim();
  config.spotify.clientSecret = document.getElementById('settings-spotify-client-secret').value.trim();
  config.spotify.redirectUri = document.getElementById('settings-spotify-redirect-uri').value;
  
  // OBS
  config.obs.host = document.getElementById('settings-obs-host').value;
  config.obs.port = parseInt(document.getElementById('settings-obs-port').value, 10);
  config.obs.password = document.getElementById('settings-obs-password').value;
  
  // Overlay
  
  // Behavior
  config.polling.intervalMs = parseInt(document.getElementById('settings-polling-interval').value, 10);
  config.behavior.startMinimized = document.getElementById('settings-start-minimized').checked;
  config.behavior.minimizeToTray = document.getElementById('settings-minimize-to-tray').checked;
  config.behavior.autoReconnect = document.getElementById('settings-auto-reconnect').checked;
  config.behavior.autoStartWithWindows = document.getElementById('settings-auto-start').checked;

  await window.api.saveConfig(config);

  // Apply auto-launch setting if changed
  window.api.setAutoLaunch(config.behavior.autoStartWithWindows);
}

// ─────────────────────────────────────────────────────────────
// Status Updates
// ─────────────────────────────────────────────────────────────

function setupStatusListeners() {
  window.api.onTrackUpdate((track) => {
    updateTrackDisplay(track);
    updateFooterStatus('spotify', track ? 'ok' : 'idle');
  });

  // Events sent before this window loaded are missed, so ask for the current state once.
  window.api.getConnectionStatus().then((status) => {
    connectionState.textSourceError = status.textSourceError;
    updateFooterStatus('obs', status.obsConnected ? 'ok' : 'idle');
  });

  window.api.onTextSourceStatus((status) => {
    connectionState.textSourceError = status.ok ? null : status.error;
    updateStatusSummary();
  });

  window.api.onOBSStatus((status) => {
    const state = status.connected ? 'ok' : 'error';
    updateFooterStatus('obs', state);
  });

  window.api.onOBSError(() => {
    updateFooterStatus('obs', 'error');
  });

  window.api.onSpotifyError(() => {
    updateFooterStatus('spotify', 'error');
  });

  window.api.onPollingStatus((enabled) => {
    isPollingEnabled = enabled;
    updatePollingButton();
    updatePollingLabel(enabled);
  });

  // Load initial log buffer and listen for new entries
  window.api.getLogBuffer().then((logs) => {
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
      logs.forEach(entry => appendLogEntry(entry));
    }
  });

  window.api.onLogEntry((entry) => {
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
      appendLogEntry(entry);
      logOutput.scrollTop = logOutput.scrollHeight;
    }
  });
}

function appendLogEntry(entry) {
  const logOutput = document.getElementById('log-output');
  if (!logOutput) return;
  
  const div = document.createElement('div');
  div.className = 'log-entry';
  
  const time = new Date(entry.timestamp).toLocaleTimeString();
  const levelClass = entry.level.toLowerCase();
  
  div.innerHTML = `
    <span class="log-timestamp">${time}</span>
    <span class="log-level ${levelClass}">${entry.level}</span>
    <span class="log-message">${escapeHtml(entry.message)}</span>
  `;
  
  logOutput.appendChild(div);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateTrackDisplay(track) {
  if (currentStep === 'complete') {
    const trackNameEl = document.getElementById('complete-track-name');
    const artistEl = document.getElementById('complete-track-artist');
    if (trackNameEl) {
      trackNameEl.textContent = track ? track.trackName : 'Waiting for a track…';
      if (artistEl) artistEl.textContent = track ? track.artistName : '';
    }
  }

  renderNowPlaying(track);
}

// ─────────────────────────────────────────────────────────────
// Now Playing rendering
// ─────────────────────────────────────────────────────────────

let currentTrackId = null;
let progressTickerId = null;
let progressBaseMs = 0;
let progressBaseAt = 0;
let progressDurationMs = 0;
let progressIsPlaying = false;

function renderNowPlaying(track) {
  const view = document.getElementById('view-home');
  if (!view) return;
  const playing = document.getElementById('now-playing');
  const empty = document.getElementById('np-empty');

  if (!track) {
    if (playing) playing.hidden = true;
    if (empty) empty.hidden = false;
    stopProgressTicker();
    currentTrackId = null;
    return;
  }

  if (playing) playing.hidden = false;
  if (empty) empty.hidden = true;

  const trackKey = `${track.trackName}|${track.artistName}|${track.albumName}`;
  const isNewTrack = trackKey !== currentTrackId;
  currentTrackId = trackKey;

  const trackEl = document.getElementById('np-track');
  const artistEl = document.getElementById('np-artist');
  const albumEl = document.getElementById('np-album');
  if (trackEl) trackEl.textContent = track.trackName;
  if (artistEl) artistEl.textContent = track.artistName;
  if (albumEl) albumEl.textContent = track.albumName || '';

  const art = document.getElementById('np-art');
  const fallback = document.getElementById('np-art-fallback');
  if (art) {
    if (track.albumArt) {
      art.alt = `${track.trackName} by ${track.artistName}, album cover`;
      if (isNewTrack || art.src !== track.albumArt) {
        art.style.opacity = '0';
        art.src = track.albumArt;
        art.onload = () => { art.style.opacity = '1'; };
        art.onerror = () => {
          art.style.opacity = '0';
          if (fallback) fallback.hidden = false;
        };
      }
      if (fallback) fallback.hidden = true;
    } else {
      art.removeAttribute('src');
      art.alt = '';
      if (fallback) fallback.hidden = false;
    }
  }

  const equalizer = document.getElementById('np-equalizer');
  if (equalizer) equalizer.classList.toggle('is-paused', !track.isPlaying);

  const obsSource = document.getElementById('np-obs-source');
  if (obsSource && config?.obs?.textSourceName) {
    obsSource.textContent = config.obs.textSourceName;
  }

  progressBaseMs = track.progressMs || 0;
  progressBaseAt = Date.now();
  progressDurationMs = track.durationMs || 0;
  progressIsPlaying = !!track.isPlaying;
  paintProgress();
  startProgressTicker();
}

function paintProgress() {
  const fill = document.getElementById('np-progress-fill');
  const bar = document.getElementById('np-progress');
  const cur = document.getElementById('np-time-current');
  const total = document.getElementById('np-time-total');
  if (!fill || !bar || !cur || !total) return;

  let nowMs = progressBaseMs;
  if (progressIsPlaying) {
    nowMs += Date.now() - progressBaseAt;
  }
  if (progressDurationMs > 0 && nowMs > progressDurationMs) {
    nowMs = progressDurationMs;
  }

  const pct = progressDurationMs > 0 ? (nowMs / progressDurationMs) * 100 : 0;
  fill.style.width = `${pct}%`;
  bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  cur.textContent = formatMs(nowMs);
  total.textContent = formatMs(progressDurationMs);
}

function formatMs(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function startProgressTicker() {
  stopProgressTicker();
  progressTickerId = setInterval(paintProgress, 1000);
}

function stopProgressTicker() {
  if (progressTickerId) {
    clearInterval(progressTickerId);
    progressTickerId = null;
  }
}

function updatePollingButton() {
  const btn = document.getElementById('btn-toggle-polling');
  if (btn) {
    btn.textContent = isPollingEnabled ? 'Pause tracking' : 'Resume tracking';
  }
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function updateIntervalDisplay(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = `${Math.round(value / 1000)} s`;
  }
}

function setupGlobalListeners() {
  // Handle errors
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
  });
}

// ─────────────────────────────────────────────────────────────
// Auto-updater
// ─────────────────────────────────────────────────────────────

function setupUpdaterListeners() {
  const checkBtn = document.getElementById('btn-check-updates');
  const resultEl = document.getElementById('update-check-result');
  const banner = document.getElementById('update-banner');
  const bannerText = document.getElementById('update-banner-text');
  const installBtn = document.getElementById('btn-install-update');

  const setResult = (message, state) => {
    resultEl.textContent = message;
    resultEl.className = state ? `test-result ${state}` : 'test-result';
  };

  checkBtn.addEventListener('click', async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = 'Checking…';
    setResult('');

    try {
      const result = await window.api.checkForUpdates();

      if (result.error) {
        setResult(`Could not check for updates: ${result.error}`, 'error');
      } else if (result.downloaded) {
        showUpdateBanner(banner, bannerText, 'Update ready. Restart to apply it.');
      } else if (result.available) {
        setResult('Downloading the update…');
      } else {
        setResult("You're on the latest version", 'success');
      }
    } catch (err) {
      setResult(`Could not check for updates: ${err.message}`, 'error');
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = 'Check for updates';
    }
  });

  installBtn.addEventListener('click', async () => {
    await window.api.installUpdate();
  });

  window.api.onUpdateDownloaded((info) => {
    showUpdateBanner(banner, bannerText, `Version ${info.version} is ready. Restart to apply it.`);
  });
}

function showUpdateBanner(banner, textEl, message) {
  textEl.textContent = message;
  banner.hidden = false;
}
