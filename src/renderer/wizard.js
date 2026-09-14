const SPOTIFY_DASHBOARD_URL = 'https://developer.spotify.com/dashboard';
const PROJECT_URL = 'https://github.com/develoverli/trackcast';
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
const connectionState = { spotify: 'idle', obs: 'idle' };

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
    loadSettingsValues();
    setupSettingsListeners();
    setupRedirectUriNotice();
  }
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
    'help.source.title': 'Step 3 · Add the text source',
    'help.source.body': 'In the OBS step of the wizard, after the connection test passes, click "Check if it exists". If the source does not exist yet, the app can create it for you in the current scene. You can then drag, resize, and style it from inside OBS.',
    'help.format.title': 'Customizing the overlay text',
    'help.format.intro': 'The format field accepts two placeholders:',
    'help.format.list': '<li><code>{trackName}</code> &mdash; current track title</li><li><code>{artistName}</code> &mdash; artist or comma-separated artists</li>',
    'help.format.example': 'Example: <code>♫ {trackName} by {artistName}</code>',
    'help.troubleshoot.title': 'Troubleshooting',
    'help.troubleshoot.body': '<dt>OBS source does not update</dt><dd>Confirm the source name in OBS matches the one configured in the app exactly, including capitalization.</dd><dt>OBS connection fails</dt><dd>Check that OBS WebSocket is enabled, the password matches, and Windows Firewall is not blocking port 4455.</dd><dt>Spotify authorization fails</dt><dd>Verify the redirect URI in your Spotify Developer dashboard is exactly <code>http://127.0.0.1:8888/callback</code>, no trailing slash.</dd><dt>"Token expired" keeps appearing</dt><dd>The app auto-refreshes tokens 5 minutes before expiry. If errors persist, go to Settings → Spotify and re-authorize.</dd><dt>App icon stays grey in tray</dt><dd>Polling is paused, no Spotify track is playing, or the Spotify connection dropped. Resume polling from the sidebar footer.</dd>',
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
    'help.source.title': 'Paso 3 · Agregar el text source',
    'help.source.body': 'En el paso OBS del wizard, después de que la prueba de conexión pasa, hacé clic en "Check if it exists". Si el source todavía no existe, la app lo puede crear por vos en la scene actual. Después lo movés, redimensionás y estilizás desde adentro de OBS.',
    'help.format.title': 'Personalizar el texto del overlay',
    'help.format.intro': 'El campo de formato acepta dos placeholders:',
    'help.format.list': '<li><code>{trackName}</code> &mdash; título del track actual</li><li><code>{artistName}</code> &mdash; artista o artistas separados por coma</li>',
    'help.format.example': 'Ejemplo: <code>♫ {trackName} por {artistName}</code>',
    'help.troubleshoot.title': 'Solución de problemas',
    'help.troubleshoot.body': '<dt>El source de OBS no se actualiza</dt><dd>Confirmá que el nombre del source en OBS coincide exactamente con el configurado en la app, mayúsculas incluidas.</dd><dt>Falla la conexión a OBS</dt><dd>Verificá que OBS WebSocket esté habilitado, que el password coincida, y que el Firewall de Windows no esté bloqueando el puerto 4455.</dd><dt>Falla la autorización de Spotify</dt><dd>Verificá que el redirect URI en tu Spotify Developer dashboard sea exactamente <code>http://127.0.0.1:8888/callback</code>, sin slash al final.</dd><dt>Aparece "Token expired" todo el tiempo</dt><dd>La app refresca tokens automáticamente 5 minutos antes de que expiren. Si persiste, andá a Settings → Spotify y re-autorizá.</dd><dt>El ícono del tray queda gris</dt><dd>El polling está pausado, no hay track sonando en Spotify, o se cayó la conexión. Reanudá el polling desde el footer del sidebar.</dd>',
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
  else if (connectionState.spotify === 'ok' && connectionState.obs === 'ok') text = 'Live on OBS';

  if (summary.textContent !== text) summary.textContent = text;
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
  setupSourceCheckListeners();

  document.getElementById('btn-obs-next').addEventListener('click', () => {
    saveOBSConfig();
    showStep('overlay');
  });

  // Overlay step
  document.getElementById('btn-overlay-back').addEventListener('click', () => {
    showStep('obs');
  });

  document.getElementById('overlay-format').addEventListener('input', updateOverlayPreview);
  document.getElementById('overlay-idle-text').addEventListener('input', updateOverlayPreview);
  document.getElementById('overlay-show-only-playing').addEventListener('change', updateOverlayPreview);

  document.getElementById('btn-overlay-next').addEventListener('click', () => {
    saveOverlayConfig();
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
  document.getElementById('obs-source-name').value = config.obs.textSourceName;
}

function initOverlayStep() {
  document.getElementById('overlay-format').value = config.overlay.format;
  document.getElementById('overlay-idle-text').value = config.overlay.idleText;
  document.getElementById('overlay-show-only-playing').checked = config.overlay.showOnlyWhenPlaying;
  updateOverlayPreview();
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
  config.obs.textSourceName = document.getElementById('obs-source-name').value;
}

function saveOverlayConfig() {
  config.overlay.format = document.getElementById('overlay-format').value;
  config.overlay.idleText = document.getElementById('overlay-idle-text').value;
  config.overlay.showOnlyWhenPlaying = document.getElementById('overlay-show-only-playing').checked;
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
      const panel = document.getElementById('source-panel');
      if (panel) panel.hidden = false;
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

function setupSourceCheckListeners() {
  const checkBtn = document.getElementById('btn-check-source');
  if (checkBtn) checkBtn.addEventListener('click', handleSourceCheck);
}

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
  btn.textContent = 'Check if it exists';

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

function updateOverlayPreview() {
  const format = document.getElementById('overlay-format').value;
  const idleText = document.getElementById('overlay-idle-text').value;
  const showOnlyPlaying = document.getElementById('overlay-show-only-playing').checked;
  
  const previewText = document.getElementById('preview-text');
  
  if (showOnlyPlaying || !idleText) {
    previewText.textContent = format
      .replace('{trackName}', 'Song Title')
      .replace('{artistName}', 'Artist Name');
  } else {
    previewText.textContent = idleText;
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
  document.getElementById('settings-obs-source-name').value = config.obs.textSourceName;
  
  // Overlay
  document.getElementById('settings-overlay-format').value = config.overlay.format;
  document.getElementById('settings-overlay-idle-text').value = config.overlay.idleText;
  document.getElementById('settings-overlay-show-only').checked = config.overlay.showOnlyWhenPlaying;
  
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
  config.obs.textSourceName = document.getElementById('settings-obs-source-name').value;
  
  // Overlay
  config.overlay.format = document.getElementById('settings-overlay-format').value;
  config.overlay.idleText = document.getElementById('settings-overlay-idle-text').value;
  config.overlay.showOnlyWhenPlaying = document.getElementById('settings-overlay-show-only').checked;
  
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
