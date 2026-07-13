import axios from 'axios';

const ACCOUNTS_API = 'https://accounts.spotify.com/api/token';
const WEB_API = 'https://api.spotify.com/v1/me/player/currently-playing';

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