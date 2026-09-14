import OBSWebSocket from 'obs-websocket-js';

// obs-websocket close codes: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
const OBS_CLOSE_AUTHENTICATION_FAILED = 4009;
const OBS_CLOSE_UNSUPPORTED_RPC_VERSION = 4010;

/**
 * Connect to OBS. `onClose` is called with this client when the connection later drops,
 * so callers can tell a stale client's close event apart from the current one.
 */
export async function connect(config, { onClose } = {}) {
  const obs = new OBSWebSocket();

  obs.on('ConnectionClosed', (error) => {
    if (onClose) onClose(obs, error);
  });

  const url = `ws://${config.obs.host}:${config.obs.port}`;
  await obs.connect(url, config.obs.password || undefined);
  return obs;
}

/** Turn obs-websocket connection errors into an actionable message. */
export function describeObsError(error, config) {
  const code = error?.code;
  const message = String(error?.message || error || '');
  const address = `${config.obs.host}:${config.obs.port}`;

  if (code === OBS_CLOSE_AUTHENTICATION_FAILED || /authentication/i.test(message)) {
    return 'OBS rejected the password. In OBS open Tools → WebSocket Server Settings → Show Connect Info and copy the server password.';
  }
  if (code === OBS_CLOSE_UNSUPPORTED_RPC_VERSION) {
    return 'This OBS version is too old. TrackCast needs OBS Studio 28 or newer (obs-websocket 5).';
  }
  if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|1006|connect|socket/i.test(message) || code === 1006 || code === -1) {
    return `OBS WebSocket is not reachable at ${address}. In OBS open Tools → WebSocket Server Settings, check Enable WebSocket server, and make sure the port matches.`;
  }
  return message || `Could not connect to OBS at ${address}.`;
}

export async function updateTextSource(obsClient, sourceName, text) {
  await obsClient.call('SetInputSettings', {
    inputName: sourceName,
    inputSettings: {
      text,
    },
  });
}

export async function getOBSsources(obsClient) {
  const response = await obsClient.call('GetInputList');
  return response.inputs || [];
}

// Preferred text input kinds, newest first. GDI+ v3 is current on Windows; FreeType covers macOS/Linux.
const TEXT_SOURCE_KINDS = ['text_gdiplus_v3', 'text_gdiplus_v2', 'text_ft2_source_v2'];
const OBS_FONT_BOLD = 1;
const OBS_FONT_ITALIC = 2;
const OBS_TEXT_TRANSFORM_UPPERCASE = 1;
const OBS_ALIGN = { left: 1, right: 2, top: 4, bottom: 8 };
const CANVAS_MARGIN = 48;
const FREETYPE_FALLBACK_FACE = 'Sans Serif';

// OBS stores colors as 0xAABBGGRR (red in the lowest byte).
function toObsColor(hex, alpha = 0) {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function fontFlags(style) {
  return (style.bold ? OBS_FONT_BOLD : 0) | (style.italic ? OBS_FONT_ITALIC : 0);
}

function fontStyleName(style) {
  if (style.bold && style.italic) return 'Bold Italic';
  if (style.bold) return 'Bold';
  if (style.italic) return 'Italic';
  return 'Regular';
}

/** Translate a TrackCast text style into OBS input settings for the given text source kind. */
export function textStyleToInputSettings(inputKind, style, horizontal = 'left') {
  const isFreeType = inputKind.startsWith('text_ft2');
  const font = {
    face: isFreeType ? FREETYPE_FALLBACK_FACE : style.face,
    size: style.size,
    style: fontStyleName(style),
    flags: fontFlags(style),
  };

  if (isFreeType) {
    const opacity = Math.round((style.opacity / 100) * 255);
    const color = toObsColor(style.color, opacity);
    return {
      font,
      color1: color,
      color2: style.gradientColor ? toObsColor(style.gradientColor, opacity) : color,
      outline: Boolean(style.outlineColor && style.outlineSize > 0),
      drop_shadow: false,
    };
  }

  return {
    font,
    color: toObsColor(style.color),
    opacity: style.opacity,
    gradient: Boolean(style.gradientColor),
    gradient_color: toObsColor(style.gradientColor || style.color),
    gradient_opacity: style.opacity,
    gradient_dir: 90,
    outline: Boolean(style.outlineColor && style.outlineSize > 0),
    outline_size: style.outlineSize || 0,
    outline_color: toObsColor(style.outlineColor || '#000000'),
    outline_opacity: 100,
    bk_color: toObsColor(style.backgroundColor || '#000000'),
    bk_opacity: style.backgroundOpacity || 0,
    transform: style.uppercase ? OBS_TEXT_TRANSFORM_UPPERCASE : 0,
    align: horizontal,
    valign: 'top',
    vertical: false,
    extents: false,
  };
}

/**
 * Create a styled text source in the current scene, anchored to `corner` of the OBS canvas.
 * `text` must not be empty: an empty GDI+ source is only 2 px wide and looks like a thin vertical bar.
 */
export async function createTextSource(obsClient, sourceName, { text, style, corner = 'bottom-left' }) {
  const { inputKinds } = await obsClient.call('GetInputKindList', { unversioned: false });
  const inputKind = TEXT_SOURCE_KINDS.find((kind) => inputKinds.includes(kind));
  if (!inputKind) {
    throw new Error('This OBS installation has no text source type available.');
  }

  const vertical = corner.startsWith('top') ? 'top' : 'bottom';
  const horizontal = corner.endsWith('right') ? 'right' : 'left';

  const { currentProgramSceneName: sceneName } = await obsClient.call('GetCurrentProgramScene');
  const { sceneItemId } = await obsClient.call('CreateInput', {
    sceneName,
    inputName: sourceName,
    inputKind,
    inputSettings: { text, ...textStyleToInputSettings(inputKind, style, horizontal) },
    sceneItemEnabled: true,
  });

  const { baseWidth, baseHeight } = await obsClient.call('GetVideoSettings');
  await obsClient.call('SetSceneItemTransform', {
    sceneName,
    sceneItemId,
    sceneItemTransform: {
      alignment: OBS_ALIGN[vertical] | OBS_ALIGN[horizontal],
      positionX: horizontal === 'left' ? CANVAS_MARGIN : baseWidth - CANVAS_MARGIN,
      positionY: vertical === 'top' ? CANVAS_MARGIN : baseHeight - CANVAS_MARGIN,
    },
  });

  return { success: true, sceneName, inputKind };
}

/** Apply a text style to an existing text source without touching its text or position. */
export async function applyTextStyle(obsClient, sourceName, style) {
  const { inputKind, inputSettings } = await obsClient.call('GetInputSettings', { inputName: sourceName });
  const horizontal = inputSettings.align === 'right' ? 'right' : 'left';
  await obsClient.call('SetInputSettings', {
    inputName: sourceName,
    inputSettings: textStyleToInputSettings(inputKind, style, horizontal),
    overlay: true,
  });
  return { success: true, inputKind };
}

export const OVERLAY_SOURCE_NAME = 'TrackCast Overlay';

async function findSceneContaining(obsClient, sourceName) {
  const { scenes } = await obsClient.call('GetSceneList');
  for (const scene of scenes) {
    try {
      await obsClient.call('GetSceneItemId', { sceneName: scene.sceneName, sourceName });
      return scene.sceneName;
    } catch {
      // Not in this scene.
    }
  }
  return null;
}

/**
 * Add the TrackCast browser overlay to the current OBS scene, sized to the OBS canvas.
 * If the source already exists, its URL and size are refreshed instead of creating a duplicate.
 */
export async function addOverlaySource(obsClient, url) {
  const { baseWidth, baseHeight } = await obsClient.call('GetVideoSettings');
  const inputSettings = {
    url,
    width: baseWidth,
    height: baseHeight,
    css: '',
    shutdown: false,
    restart_when_active: false,
    reroute_audio: false,
  };

  const { inputs } = await obsClient.call('GetInputList');
  const existing = inputs.find((input) => input.inputName === OVERLAY_SOURCE_NAME);

  if (existing) {
    await obsClient.call('SetInputSettings', { inputName: OVERLAY_SOURCE_NAME, inputSettings });
    const sceneName = await findSceneContaining(obsClient, OVERLAY_SOURCE_NAME);
    return { created: false, sceneName, sourceName: OVERLAY_SOURCE_NAME };
  }

  const { currentProgramSceneName: sceneName } = await obsClient.call('GetCurrentProgramScene');
  await obsClient.call('CreateInput', {
    sceneName,
    inputName: OVERLAY_SOURCE_NAME,
    inputKind: 'browser_source',
    inputSettings,
    sceneItemEnabled: true,
  });
  return { created: true, sceneName, sourceName: OVERLAY_SOURCE_NAME };
}
