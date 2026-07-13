import OBSWebSocket from 'obs-websocket-js';

export async function connect(config) {
  const obs = new OBSWebSocket();

  obs.on('ConnectionError', (error) => {
    console.error('[OBS] WebSocket error:', error?.message || error);
  });

  obs.on('ConnectionClosed', () => {
    console.log('[OBS] Disconnected');
  });

  const url = `ws://${config.obs.host}:${config.obs.port}`;
  await obs.connect(url, config.obs.password);

  console.log(`[OBS] Connected to ${config.obs.host}:${config.obs.port}`);
  return obs;
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

export async function createTextSource(obsClient, sourceName, settings = {}) {
  const sceneResponse = await obsClient.call('GetCurrentProgramScene');
  const sceneName = sceneResponse.currentProgramSceneName;

  await obsClient.call('CreateInput', {
    sceneName,
    inputName: sourceName,
    inputKind: 'text_gdiplus_v2',
    inputSettings: {
      text: settings.text || '',
      font: {
        face: settings.fontFamily || 'Arial',
        size: settings.fontSize || 48,
        style: settings.fontStyle || 'Normal',
        weight: settings.fontWeight || 400,
      },
      font_color: settings.fontColor || 0xFFFFFFFF,
      outline: settings.showOutline ? {
        color: settings.outlineColor || 0xFF000000,
        width: settings.outlineWidth || 2,
      } : undefined,
      background: settings.backgroundColor !== undefined ? {
        color: settings.backgroundColor || 0x80000000,
      } : undefined,
      align: 'left',
      valign: 'top',
    },
    enabled: true,
  });

  return { success: true, sceneName };
}
