import axios from 'axios';

const ACCOUNTS_API = 'https://accounts.spotify.com/api/token';
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const AUTH_SCOPES = 'user-read-currently-playing user-read-playback-state';
const WEB_API = 'https://api.spotify.com/v1/me/player/currently-playing';
// Spotify Client IDs and secrets are 32 hexadecimal characters.
const CREDENTIAL_PATTERN = /^[0-9a-f]{32}$/i;

export function validateAppCredentials({ clientId, clientSecret, redirectUri }) {
  if (!CREDENTIAL_PATTERN.test(clientId || '')) {
    return 'The Client ID must be the 32-character ID from your Spotify app settings.';
  }
  if (!CREDENTIAL_PATTERN.test(clientSecret || '')) {
    return 'The Client secret must be the 32-character secret from your Spotify app settings.';
  }
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
  } catch {
    return 'The Redirect URI is not a valid http(s) URL.';
  }
  return null;
}

export async function refreshAccessToken(config) {
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', config.spotify.refreshToken);

  const response = await axios.post(ACCOUNTS_API, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(
        config.spotify.clientId + ':' + config.spotify.clientSecret
      ).toString('base64'),
    },
  });

  return response.data.access_token;
}

export function buildAuthorizeUrl(spotify, state) {
  const params = new URLSearchParams({
    client_id: spotify.clientId,
    response_type: 'code',
    redirect_uri: spotify.redirectUri,
    scope: AUTH_SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(spotify, code) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: spotify.redirectUri,
  });

  try {
    const response = await axios.post(ACCOUNTS_API, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          spotify.clientId + ':' + spotify.clientSecret
        ).toString('base64'),
      },
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresInMs: response.data.expires_in * 1000,
    };
  } catch (error) {
    const description = error.response?.data?.error_description;
    throw new Error(description ? `Spotify rejected the authorization: ${description}` : error.message);
  }
}

export async function getCurrentlyPlaying(accessToken) {
  if (!accessToken) return null;
  
  try {
    const response = await axios.get(WEB_API, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      },
    });

    if (response.status === 204) {
      return null;
    }

    const data = response.data;
    if (!data || (!data.is_playing && !data.item)) {
      return null;
    }

    const trackName = data.item?.name;
    const artistName = data.item?.artists?.map(a => a.name).join(', ');

    if (!trackName) {
      return null;
    }

    return {
      isPlaying: data.is_playing,
      trackName,
      artistName: artistName || 'Unknown Artist',
      albumArt: data.item?.album?.images?.[0]?.url || null,
      albumName: data.item?.album?.name || '',
      durationMs: data.item?.duration_ms || 0,
      progressMs: data.progress_ms || 0,
    };
  } catch (error) {
    if (error.response?.status === 401) {
      const err = new Error('Token expired');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }
    if (error.response?.status === 204) {
      return null;
    }
    throw error;
  }
}

export async function getSpotifyUserInfo(accessToken) {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      },
    });
    return {
      id: response.data.id,
      display_name: response.data.display_name,
      images: response.data.images,
    };
  } catch (error) {
    throw error;
  }
}