// State
let config = null;
let currentStep = 'welcome';
let isPollingEnabled = true;
let authServer = null;

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  config = await window.api.getConfig();

  setupWindowControls();

  if (config.setup.completed) {
    enableAppShell();
    setupSidebarListeners();
    setupHelpLanguageToggle();
    showView('home');
    loadSettingsValues();
    setupSettingsListeners();
    updatePollingLabel(config.polling.enabled !== false);
    window.api.getCurrentTrack().then((track) => renderNowPlaying(track));
  } else {
    showStep('welcome');
    setupWizardListeners();
  }

  setupStatusListeners();
  setupGlobalListeners();

  updateIntervalDisplay('polling-interval', config.polling.intervalMs);
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
  if (step) {
    step.classList.add('active');
    currentStep = stepName;
  }
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

function showWizard() {
  document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
  const wizard = document.getElementById('wizard-container');
  if (wizard) wizard.hidden = false;
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
    'help.spotify.body': '<li>Go to <strong>developer.spotify.com/dashboard</strong> and sign in with your Spotify account.</li><li>Click <strong>Create app</strong>. Name and description can be anything.</li><li>In <strong>Redirect URIs</strong> add exactly: <code>http://localhost:8888/callback</code></li><li>Save. Open the app, then click <strong>Settings</strong> to copy your Client ID and Client Secret.</li>',
    'help.obs.title': 'Step 2 · Enable OBS WebSocket',
    'help.obs.body': '<li>Open OBS Studio.</li><li>Top menu: <strong>Tools → WebSocket Server Settings</strong>.</li><li>Check <strong>Enable WebSocket server</strong>.</li><li>Set a server password and note it down. Default port is <code>4455</code>.</li><li>Click OK.</li>',
    'help.source.title': 'Step 3 · Add the text source',
    'help.source.body': 'In the OBS step of the wizard, after the connection test passes, click "Check if it exists". If the source does not exist yet, the app can create it for you in the current scene. You can then drag, resize, and style it from inside OBS.',
    'help.format.title': 'Customizing the overlay text',
    'help.format.intro': 'The format field accepts two placeholders:',
    'help.format.list': '<li><code>{trackName}</code> &mdash; current track title</li><li><code>{artistName}</code> &mdash; artist or comma-separated artists</li>',
    'help.format.example': 'Example: <code>♫ {trackName} by {artistName}</code>',
    'help.troubleshoot.title': 'Troubleshooting',
    'help.troubleshoot.body': '<dt>OBS source does not update</dt><dd>Confirm the source name in OBS matches the one configured in the app exactly, including capitalization.</dd><dt>OBS connection fails</dt><dd>Check that OBS WebSocket is enabled, the password matches, and Windows Firewall is not blocking port 4455.</dd><dt>Spotify authorization fails</dt><dd>Verify the redirect URI in your Spotify Developer dashboard is exactly <code>http://localhost:8888/callback</code>, no trailing slash.</dd><dt>"Token expired" keeps appearing</dt><dd>The app auto-refreshes tokens 5 minutes before expiry. If errors persist, go to Settings → Spotify and re-authorize.</dd><dt>App icon stays grey in tray</dt><dd>Polling is paused, no Spotify track is playing, or the Spotify connection dropped. Resume polling from the sidebar footer.</dd>',
    'help.logs.title': 'Logs & reporting bugs',
    'help.logs.body': 'Detailed logs are stored at <code>%APPDATA%\\TrackCast\\logs\\main.log</code>. Include the last 100 lines when reporting an issue on GitHub.',
  },
  es: {
    'help.title': 'Ayuda y guía de configuración',
    'help.lede': 'Todo lo que necesitás para que TrackCast funcione con Spotify y OBS.',
    'help.quickstart.title': 'Inicio rápido',
    'help.quickstart.body': '<li>Creá una app gratis en Spotify Developer y copiá su Client ID y Secret.</li><li>Activá OBS WebSocket (menú Tools dentro de OBS Studio).</li><li>Ejecutá esta app y seguí el wizard. Listo.</li>',
    'help.spotify.title': 'Paso 1 · Crear una app en Spotify Developer',
    'help.spotify.body': '<li>Andá a <strong>developer.spotify.com/dashboard</strong> e iniciá sesión con tu cuenta de Spotify.</li><li>Hacé clic en <strong>Create app</strong>. Nombre y descripción pueden ser cualquier cosa.</li><li>En <strong>Redirect URIs</strong> agregá exactamente: <code>http://localhost:8888/callback</code></li><li>Guardá. Abrí la app y entrá en <strong>Settings</strong> para copiar Client ID y Client Secret.</li>',
    'help.obs.title': 'Paso 2 · Habilitar OBS WebSocket',
    'help.obs.body': '<li>Abrí OBS Studio.</li><li>Menú superior: <strong>Tools → WebSocket Server Settings</strong>.</li><li>Marcá <strong>Enable WebSocket server</strong>.</li><li>Definí un password de servidor y anotalo. El puerto por defecto es <code>4455</code>.</li><li>Clic en OK.</li>',
    'help.source.title': 'Paso 3 · Agregar el text source',
    'help.source.body': 'En el paso OBS del wizard, después de que la prueba de conexión pasa, hacé clic en "Check if it exists". Si el source todavía no existe, la app lo puede crear por vos en la scene actual. Después lo movés, redimensionás y estilizás desde adentro de OBS.',
    'help.format.title': 'Personalizar el texto del overlay',
    'help.format.intro': 'El campo de formato acepta dos placeholders:',
    'help.format.list': '<li><code>{trackName}</code> &mdash; título del track actual</li><li><code>{artistName}</code> &mdash; artista o artistas separados por coma</li>',
    'help.format.example': 'Ejemplo: <code>♫ {trackName} por {artistName}</code>',
    'help.troubleshoot.title': 'Solución de problemas',
    'help.troubleshoot.body': '<dt>El source de OBS no se actualiza</dt><dd>Confirmá que el nombre del source en OBS coincide exactamente con el configurado en la app, mayúsculas incluidas.</dd><dt>Falla la conexión a OBS</dt><dd>Verificá que OBS WebSocket esté habilitado, que el password coincida, y que el Firewall de Windows no esté bloqueando el puerto 4455.</dd><dt>Falla la autorización de Spotify</dt><dd>Verificá que el redirect URI en tu Spotify Developer dashboard sea exactamente <code>http://localhost:8888/callback</code>, sin slash al final.</dd><dt>Aparece "Token expired" todo el tiempo</dt><dd>La app refresca tokens automáticamente 5 minutos antes de que expiren. Si persiste, andá a Settings → Spotify y re-autorizá.</dd><dt>El ícono del tray queda gris</dt><dd>El polling está pausado, no hay track sonando en Spotify, o se cayó la conexión. Reanudá el polling desde el footer del sidebar.</dd>',
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

function updatePollingLabel(enabled) {
  const btn = document.getElementById('btn-sidebar-polling');
  const label = document.getElementById('sidebar-polling-label');
  if (!btn || !label) return;
  btn.classList.toggle('is-paused', !enabled);
  label.textContent = enabled ? 'Polling on' : 'Polling paused';
}

function updateFooterStatus(service, state) {
  const root = document.getElementById(`footer-${service}`);
  if (!root) return;
  const dot = root.querySelector('.status-dot');
  if (!dot) return;
  dot.classList.remove('status-dot--idle', 'status-dot--ok', 'status-dot--error');
  if (state === 'ok' || state === 'connected' || state === 'playing') {
    dot.classList.add('status-dot--ok');
  } else if (state === 'error') {
    dot.classList.add('status-dot--error');
  } else {
    dot.classList.add('status-dot--idle');
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
    window.api.openExternal('https://developer.spotify.com/dashboard');
  });

  document.getElementById('btn-spotify-back').addEventListener('click', () => {
    showStep('welcome');
  });

  document.getElementById('spotify-client-id').addEventListener('input', checkSpotifyCredentials);
  document.getElementById('spotify-client-secret').addEventListener('input', checkSpotifyCredentials);

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
    updateIntervalDisplay('polling-interval-display', parseInt(e.target.value));
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

  document.getElementById('btn-open-settings').addEventListener('click', () => {
    enableAppShell();
    setupSidebarListeners();
    setupHelpLanguageToggle();
    loadSettingsValues();
    setupSettingsListeners();
    showView('home');
    updatePollingLabel(config.polling.enabled !== false);
  });

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
  if (config.spotify.clientId) {
    document.getElementById('spotify-client-id').value = config.spotify.clientId;
  }
  if (config.spotify.clientSecret) {
    document.getElementById('spotify-client-secret').value = config.spotify.clientSecret;
  }
  if (config.spotify.redirectUri) {
    document.getElementById('spotify-redirect-uri').value = config.spotify.redirectUri;
  }
  document.getElementById('redirect-uri-display').textContent = config.spotify.redirectUri;
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
  config.obs.port = parseInt(document.getElementById('obs-port').value);
  config.obs.password = document.getElementById('obs-password').value;
  config.obs.textSourceName = document.getElementById('obs-source-name').value;
}

function saveOverlayConfig() {
  config.overlay.format = document.getElementById('overlay-format').value;
  config.overlay.idleText = document.getElementById('overlay-idle-text').value;
  config.overlay.showOnlyWhenPlaying = document.getElementById('overlay-show-only-playing').checked;
}

function saveBehaviorConfig() {
  config.polling.intervalMs = parseInt(document.getElementById('polling-interval').value);
  config.behavior.startMinimized = document.getElementById('behavior-start-minimized').checked;
  config.behavior.minimizeToTray = document.getElementById('behavior-minimize-to-tray').checked;
  config.behavior.autoReconnect = document.getElementById('behavior-auto-reconnect').checked;
  config.behavior.autoStartWithWindows = document.getElementById('behavior-auto-start').checked;

  // Apply auto-launch setting immediately
  window.api.setAutoLaunch(config.behavior.autoStartWithWindows);
}

async function finishSetup() {
  // Save Spotify credentials
  config.spotify.clientId = document.getElementById('spotify-client-id').value;
  config.spotify.clientSecret = document.getElementById('spotify-client-secret').value;
  config.spotify.redirectUri = document.getElementById('spotify-redirect-uri').value;
  
  config.setup.completed = true;
  
  await window.api.saveConfig(config);
}

async function checkSpotifyCredentials() {
  const clientId = document.getElementById('spotify-client-id').value.trim();
  const clientSecret = document.getElementById('spotify-client-secret').value.trim();
  const nextBtn = document.getElementById('btn-spotify-next');
  const authSection = document.getElementById('spotify-authorize-section');

  if (clientId && clientSecret) {
    config.spotify.clientId = clientId;
    config.spotify.clientSecret = clientSecret;
    nextBtn.disabled = !config.spotify.refreshToken;
    authSection.classList.remove('hidden');
  } else {
    nextBtn.disabled = true;
    authSection.classList.add('hidden');
  }
}

// ─────────────────────────────────────────────────────────────
// Spotify Auth
// ─────────────────────────────────────────────────────────────

async function startSpotifyAuth() {
  const statusEl = document.getElementById('auth-status');
  statusEl.textContent = 'Waiting for authorization...';
  statusEl.className = 'auth-status-text';

  try {
    // First save the current credentials
    config.spotify.clientId = document.getElementById('spotify-client-id').value.trim();
    config.spotify.clientSecret = document.getElementById('spotify-client-secret').value.trim();
    config.spotify.redirectUri = document.getElementById('spotify-redirect-uri').value.trim();
    await window.api.saveConfig(config);

    // Build the auth URL
    const scopes = 'user-read-currently-playing user-read-playback-state';
    const params = new URLSearchParams({
      client_id: config.spotify.clientId,
      response_type: 'code',
      redirect_uri: config.spotify.redirectUri,
      scope: scopes,
    });
    const authUrl = 'https://accounts.spotify.com/authorize?' + params.toString();

    // Start auth server FIRST, then open browser
    window.api.startAuthServer(config).then(async (authCode) => {
      // Auth server received the code
      await exchangeCodeForToken(authCode);
    }).catch((err) => {
      statusEl.textContent = 'Error: ' + err.message;
      statusEl.className = 'auth-status-text error';
    });

    // Open auth URL in browser
    window.api.openExternal(authUrl);

  } catch (error) {
    statusEl.textContent = 'Error: ' + error.message;
    statusEl.className = 'auth-status-text error';
  }
}

async function exchangeCodeForToken(code) {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(config.spotify.clientId + ':' + config.spotify.clientSecret),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.spotify.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();
    
    config.spotify.refreshToken = data.refresh_token;
    config.spotify.accessToken = data.access_token;
    config.spotify.accessTokenExpiresAt = Date.now() + (data.expires_in * 1000);
    
    await window.api.saveConfig(config);

    document.getElementById('spotify-test-result').textContent = 'Authorized!';
    document.getElementById('spotify-test-result').className = 'test-result success';
    document.getElementById('btn-spotify-next').disabled = false;
    
    const statusEl = document.getElementById('auth-status');
    statusEl.textContent = 'Authorization successful!';
    statusEl.className = 'auth-status-text success';

    // Show connected state
    document.getElementById('spotify-auth-section').classList.remove('hidden');
    document.getElementById('spotify-authorize-section').classList.add('hidden');
    document.getElementById('spotify-not-configured').classList.add('hidden');

    return data;

  } catch (error) {
    const statusEl = document.getElementById('auth-status');
    statusEl.textContent = 'Error: ' + error.message;
    statusEl.className = 'auth-status-text error';
    throw error;
  }
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
  btn.textContent = 'Testing...';
  resultEl.textContent = '';
  resultEl.className = 'test-result';

  try {
    const result = await window.api.testOBSConnection();
    
    if (result.success) {
      resultEl.textContent = 'Connected!';
      resultEl.className = 'test-result success';
      updateStatusIndicator('obs', 'connected');
      const panel = document.getElementById('source-panel');
      if (panel) panel.hidden = false;
    } else {
      resultEl.textContent = 'Failed: ' + result.error;
      resultEl.className = 'test-result error';
      updateStatusIndicator('obs', 'error');
    }
  } catch (error) {
    resultEl.textContent = 'Error: ' + error.message;
    resultEl.className = 'test-result error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test Connection';
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
  btn.textContent = 'Checking...';
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
    result.innerHTML = `<div class="source-result__row">Source found${scene}. You are ready.</div>`;
    return;
  }

  if (data.suggestion) {
    result.className = 'source-result source-result--warn';
    result.innerHTML = `
      <div class="source-result__row">
        Not found. Did you mean <strong>${escapeHtml(data.suggestion)}</strong>?
      </div>
      <div class="source-result__action">
        <button class="btn btn--secondary" id="btn-use-suggestion" type="button">Use this name</button>
        <button class="btn btn--secondary" id="btn-create-source" type="button">Create new source</button>
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
      <button class="btn btn--primary" id="btn-create-source" type="button">Create it for me</button>
    </div>
  `;
  document.getElementById('btn-create-source')?.addEventListener('click', () => handleSourceCreate(sourceName));
}

async function handleSourceCreate(sourceName) {
  const btn = document.getElementById('btn-create-source');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
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
  
  if (showOnlyPlaying) {
    previewText.textContent = format
      .replace('{trackName}', 'Song Title')
      .replace('{artistName}', 'Artist Name');
  } else if (idleText) {
    previewText.textContent = idleText;
  } else {
    previewText.textContent = format
      .replace('{trackName}', 'Song Title')
      .replace('{artistName}', 'Artist Name');
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
  // Close settings
  document.getElementById('btn-close-settings').addEventListener('click', () => {
    showStep('complete');
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Polling interval
  document.getElementById('settings-polling-interval').addEventListener('input', (e) => {
    updateIntervalDisplay('settings-polling-display', parseInt(e.target.value));
  });

  // Test OBS
  document.getElementById('btn-test-obs-settings').addEventListener('click', async () => {
    // First save current settings
    await saveSettingsToConfig();
    
    const resultEl = document.getElementById('settings-obs-test-result');
    resultEl.textContent = 'Testing...';
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
  document.getElementById('btn-reauthorize-spotify').addEventListener('click', () => {
    startSpotifyAuth();
  });

  // Clear logs
  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    const logOutput = document.getElementById('log-output');
    logOutput.innerHTML = '';
  });

  // Setup updater listeners
  setupUpdaterListeners();

  // Save settings
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    await saveSettingsToConfig();

    // Restart polling with new interval
    if (config.polling.enabled) {
      await window.api.stopPolling();
      await window.api.startPolling();
    }
  });
}

async function saveSettingsToConfig() {
  // Spotify
  config.spotify.clientId = document.getElementById('settings-spotify-client-id').value;
  config.spotify.clientSecret = document.getElementById('settings-spotify-client-secret').value;
  config.spotify.redirectUri = document.getElementById('settings-spotify-redirect-uri').value;
  
  // OBS
  config.obs.host = document.getElementById('settings-obs-host').value;
  config.obs.port = parseInt(document.getElementById('settings-obs-port').value);
  config.obs.password = document.getElementById('settings-obs-password').value;
  config.obs.textSourceName = document.getElementById('settings-obs-source-name').value;
  
  // Overlay
  config.overlay.format = document.getElementById('settings-overlay-format').value;
  config.overlay.idleText = document.getElementById('settings-overlay-idle-text').value;
  config.overlay.showOnlyWhenPlaying = document.getElementById('settings-overlay-show-only').checked;
  
  // Behavior
  config.polling.intervalMs = parseInt(document.getElementById('settings-polling-interval').value);
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
    updateStatusIndicator('obs', status.connected ? 'connected' : 'error');
    updateFooterStatus('obs', state);
  });

  window.api.onOBSError(() => {
    updateStatusIndicator('obs', 'error');
    updateFooterStatus('obs', 'error');
  });

  window.api.onSpotifyError(() => {
    updateStatusIndicator('spotify', 'error');
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

function updateStatusIndicator(service, status) {
  const indicator = document.getElementById(`${service}-status`);
  if (!indicator) return;
  
  indicator.className = 'status-indicator';
  
  switch (status) {
    case 'connected':
    case 'playing':
      indicator.classList.add('status-connected');
      break;
    case 'error':
      indicator.classList.add('status-error');
      break;
    default:
      indicator.classList.add('status-idle');
  }
}

function updateTrackDisplay(track) {
  if (currentStep === 'complete') {
    const trackNameEl = document.getElementById('complete-track-name');
    const artistEl = document.getElementById('complete-track-artist');
    if (trackNameEl) {
      trackNameEl.textContent = track ? track.trackName : 'No track playing';
      if (artistEl) artistEl.textContent = track ? track.artistName : '';
    }
  }

  renderNowPlaying(track);
  updateStatusIndicator('spotify', track ? 'playing' : 'idle');
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
    btn.textContent = isPollingEnabled ? 'Pause Tracking' : 'Resume Tracking';
  }
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function updateIntervalDisplay(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = value + 'ms';
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
  // Check for updates button
  const checkBtn = document.getElementById('btn-check-updates');
  const resultEl = document.getElementById('update-check-result');
  const banner = document.getElementById('update-banner');
  const bannerText = document.getElementById('update-banner-text');
  const installBtn = document.getElementById('btn-install-update');
  const updateStatus = document.getElementById('update-status');

  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      checkBtn.disabled = true;
      checkBtn.textContent = 'Checking...';
      resultEl.textContent = '';
      resultEl.className = 'update-result';

      try {
        const result = await window.api.checkForUpdates();

        if (result.error) {
          resultEl.textContent = 'Error: ' + result.error;
          resultEl.className = 'update-result error';
        } else if (result.downloaded) {
          resultEl.textContent = 'Update ready! Restart to apply.';
          resultEl.className = 'update-result success';
          showUpdateBanner(banner, bannerText, 'Update ready! Restart to apply.');
          updateStatus.classList.remove('hidden', 'status-idle');
          updateStatus.classList.add('status-connected');
        } else if (result.available) {
          resultEl.textContent = 'Downloading...';
          resultEl.className = 'update-result info';
        } else {
          resultEl.textContent = 'Up to date';
          resultEl.className = 'update-result success';
        }
      } catch (err) {
        resultEl.textContent = 'Error: ' + err.message;
        resultEl.className = 'update-result error';
      } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check for Updates';
      }
    });
  }

  // Install update button
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      await window.api.installUpdate();
    });
  }

  // Listen for updater status messages
  window.api.onUpdaterStatus((message) => {
    if (message) {
      updateStatus.classList.remove('hidden', 'status-idle');
      updateStatus.classList.add('status-connected');
      document.getElementById('update-status-text').textContent = 'Update';
    }
  });

  // Listen for update downloaded event
  window.api.onUpdateDownloaded((info) => {
    showUpdateBanner(banner, bannerText, `v${info.version} ready. Restart to apply.`);
    updateStatus.classList.remove('hidden', 'status-idle');
    updateStatus.classList.add('status-connected');
  });
}

function showUpdateBanner(banner, textEl, message) {
  if (banner && textEl) {
    textEl.textContent = message;
    banner.classList.remove('hidden');
  }
}