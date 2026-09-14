// TrackCast OBS overlay client. Receives state from the app over Server-Sent Events.
(function () {
  const EVENTS_URL = '/overlay/events';
  const HIDE_AFTER_DISCONNECT_MS = 4000;
  const PROGRESS_TICK_MS = 500;
  const SWAP_MS = 180;
  const EDGE_PX = 48;
  const STYLE_MESSAGE_TYPE = 'trackcast:overlay-style';

  const DEFAULT_STYLE = {
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
    labels: { nowPlaying: 'Now playing', paused: 'Paused' },
  };

  // Shown only inside the app's live preview when nothing is playing.
  const PREVIEW_TRACK = {
    isPlaying: true,
    trackName: 'Midnight City',
    artistName: 'M83',
    albumName: "Hurry Up, We're Dreaming",
    albumArt: null,
    durationMs: 243000,
    progressMs: 96000,
  };

  const params = new URLSearchParams(location.search);
  const isPreview = params.has('preview');

  const el = {
    stage: document.getElementById('stage'),
    widget: document.getElementById('widget'),
    body: document.getElementById('body'),
    art: document.getElementById('art'),
    label: document.getElementById('label'),
    title: document.getElementById('title'),
    artist: document.getElementById('artist'),
    album: document.getElementById('album'),
    fill: document.getElementById('progress-fill'),
  };

  let style = { ...DEFAULT_STYLE };
  let previewStyle = null;
  let track = null;
  let tracking = true;
  let receivedAt = Date.now();
  let lastTrackKey = null;
  let disconnectTimer = null;

  function mergeStyle(base, patch) {
    if (!patch) return base;
    return { ...base, ...patch, labels: { ...base.labels, ...(patch.labels || {}) } };
  }

  function currentStyle() {
    return previewStyle || style;
  }

  const ALLOWED = {
    layout: ['card', 'compact', 'minimal'],
    font: ['jakarta', 'inter', 'space-grotesk', 'anton', 'playfair', 'press-start', 'jetbrains-mono', 'fredoka', 'system'],
    radius: ['sharp', 'rounded', 'pill'],
    border: ['none', 'subtle', 'accent', 'gradient'],
    effect: ['none', 'shadow', 'glow', 'hard-shadow', 'text-shadow'],
    corner: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    animation: ['slide', 'fade', 'none'],
  };

  function pick(key, value) {
    return ALLOWED[key].includes(value) ? value : DEFAULT_STYLE[key];
  }

  function safeColor(value, fallback) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }

  function hexToRgbTriplet(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  }

  function clamp(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
  }

  function applyStyle(s) {
    const w = el.widget;
    w.dataset.layout = pick('layout', s.layout);
    w.dataset.animation = pick('animation', s.animation);
    w.dataset.font = pick('font', s.font);
    w.dataset.radius = pick('radius', s.radius);
    w.dataset.border = pick('border', s.border);
    w.dataset.effect = pick('effect', s.effect);
    w.dataset.uppercase = String(Boolean(s.uppercaseTitle));
    w.dataset.showArt = String(s.showAlbumArt);
    w.dataset.showArtist = String(s.showArtist);
    w.dataset.showAlbum = String(s.showAlbum);
    w.dataset.showProgress = String(s.showProgress);
    el.stage.dataset.corner = pick('corner', s.corner);

    const root = document.documentElement.style;
    const accent = safeColor(s.accent, DEFAULT_STYLE.accent);
    const accent2 = safeColor(s.accent2, accent);
    const text = safeColor(s.textColor, DEFAULT_STYLE.textColor);
    root.setProperty('--accent', accent);
    root.setProperty('--accent-rgb', hexToRgbTriplet(accent));
    root.setProperty('--accent2', accent2);
    root.setProperty('--text', text);
    root.setProperty('--text-rgb', hexToRgbTriplet(text));
    root.setProperty('--surface-rgb', hexToRgbTriplet(safeColor(s.surfaceColor, DEFAULT_STYLE.surfaceColor)));
    root.setProperty('--surface-alpha', String(clamp(s.surfaceOpacity, 0, 1, DEFAULT_STYLE.surfaceOpacity)));
    root.setProperty('--scale', String(clamp(s.scale, 0.5, 2, 1)));
    root.setProperty('--edge', `${isPreview ? EDGE_PX / 2 : EDGE_PX}px`);
  }

  function formatMode(t, s) {
    if (!tracking) return 'hidden';
    if (!t) return s.whenPaused === 'idle' ? 'idle' : 'hidden';
    if (t.isPlaying) return 'playing';
    if (s.whenPaused === 'paused') return 'paused';
    if (s.whenPaused === 'idle') return 'idle';
    return 'hidden';
  }

  function setText(node, value) {
    if (node.textContent !== value) node.textContent = value || '';
  }

  function renderContent(t, s, mode) {
    el.widget.dataset.mode = mode;

    if (mode === 'idle') {
      setText(el.label, '');
      setText(el.title, s.idleMessage);
      setText(el.artist, '');
      setText(el.album, '');
      el.art.classList.remove('is-loaded');
      el.art.removeAttribute('src');
      return;
    }

    setText(el.label, mode === 'paused' ? s.labels.paused : s.labels.nowPlaying);
    setText(el.title, t.trackName);
    setText(el.artist, t.artistName);
    setText(el.album, t.albumName);
    const showsArtist = s.showArtist && Boolean(t.artistName);
    const showsAlbum = s.showAlbum && Boolean(t.albumName);
    el.widget.dataset.hasMeta = String(showsArtist || showsAlbum);

    const artUrl = t.albumArt || '';
    if (el.art.getAttribute('src') !== artUrl) {
      el.art.classList.remove('is-loaded');
      if (artUrl) el.art.src = artUrl;
      else el.art.removeAttribute('src');
    }
  }

  function render() {
    const s = currentStyle();
    const t = track || (isPreview ? PREVIEW_TRACK : null);
    applyStyle(s);

    const mode = formatMode(t, s);
    const visible = mode !== 'hidden';
    const key = t ? `${t.trackName}|${t.artistName}|${t.albumName}|${mode}` : mode;

    if (visible && lastTrackKey !== null && key !== lastTrackKey && el.widget.dataset.visible === 'true') {
      el.body.classList.add('is-swapping');
      setTimeout(() => {
        renderContent(t, s, mode);
        el.body.classList.remove('is-swapping');
      }, SWAP_MS);
    } else if (visible) {
      renderContent(t, s, mode);
    }

    lastTrackKey = key;
    el.widget.dataset.visible = String(visible);
    paintProgress();
  }

  function paintProgress() {
    const t = track || (isPreview ? PREVIEW_TRACK : null);
    if (!t || !t.durationMs) {
      el.fill.style.transform = 'scaleX(0)';
      return;
    }
    let progress = t.progressMs || 0;
    if (t.isPlaying && track) progress += Date.now() - receivedAt;
    const ratio = Math.min(Math.max(progress / t.durationMs, 0), 1);
    el.fill.style.transform = `scaleX(${ratio})`;
  }

  el.art.addEventListener('load', () => el.art.classList.add('is-loaded'));
  el.art.addEventListener('error', () => el.art.classList.remove('is-loaded'));

  function connect() {
    const source = new EventSource(EVENTS_URL);

    source.onmessage = (event) => {
      clearTimeout(disconnectTimer);
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      style = mergeStyle(DEFAULT_STYLE, payload.style);
      track = payload.track || null;
      tracking = payload.tracking !== false;
      receivedAt = Date.now();
      render();
    };

    source.onerror = () => {
      // EventSource reconnects on its own; hide if the app stays unreachable.
      clearTimeout(disconnectTimer);
      disconnectTimer = setTimeout(() => {
        track = null;
        tracking = isPreview;
        render();
      }, HIDE_AFTER_DISCONNECT_MS);
    };
  }

  // The app's Settings preview sends unsaved style changes to this frame.
  if (isPreview) {
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent) return;
      const data = event.data;
      if (!data || data.type !== STYLE_MESSAGE_TYPE) return;
      previewStyle = mergeStyle(DEFAULT_STYLE, data.style);
      render();
    });
  }

  setInterval(paintProgress, PROGRESS_TICK_MS);
  render();
  connect();
})();
