import { getSDK } from './vendor/index.mjs';
import { createPlatformStorage } from './storage.mjs';
import { RESIDENTS } from '../src/community-life.mjs';

export function createPlatformTransport(sdk) {
  const profiles = new Map();
  async function request(endpoint, options) {
    const response = await sdk.http.request(endpoint, { timeoutMs: 15_000, ...options });
    if (response.status >= 200 && response.status < 300) return response.body;
    throw Object.assign(new Error(response.body?.message || `请求失败（${response.status}）`), {
      status: response.status, code: response.body?.error || 'HTTP_ERROR',
    });
  }
  return {
    getState: () => request('getState'),
    sendAction: action => request('sendAction', { json: action }),
    getLeaderboard: (sort = 'members') => request('getLeaderboard', { query: { sort } }),
    getUserProfile(userId) {
      if (!sdk.permissions.has('user.lookup')) return Promise.reject(new Error('用户资料暂不可用'));
      if (!profiles.has(userId)) profiles.set(userId, sdk.user.getById(userId, { timeoutMs: 8000 }).catch(error => { profiles.delete(userId); throw error; }));
      return profiles.get(userId);
    },
  };
}

export async function initializeMapp({ render, sdk = getSDK() } = {}) {
  let ready = false;
  try {
    await sdk.ready;
    ready = true;
    for (const permission of ['storage.read', 'storage.write', 'files.save', 'audio.webAudio', 'user.read', 'network.request']) {
      if (!sdk.permissions.has(permission)) throw new Error(`需要平台批准 ${permission} 权限`);
    }
    const storage = await createPlatformStorage(sdk.localStorage);
    const scene = await sdk.assets.readBytes('assets/community-sharing-day-v2.png', { timeoutMs: 15_000 });
    const sceneUrl = URL.createObjectURL(new Blob([scene], { type: 'image/png' }));
    // Local avatar assets become blob URLs so the sandbox never needs a remote image host.
    const avatars = {};
    await Promise.all(RESIDENTS.map(async person => {
      try {
        const bytes = await sdk.assets.readBytes(person.avatar, { timeoutMs: 15_000 });
        avatars[person.avatar] = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
      } catch { /* decorative only; fall back to the packaged relative path */ }
    }));
    await render(createPlatformTransport(sdk), { storage, sceneUrl, avatars, saveFile: (name, data) => sdk.files.save(name, data) });
  } catch (error) {
    const notice = document.createElement('p');
    notice.setAttribute('role', 'alert');
    notice.textContent = `游戏加载失败：${error.message}。请关闭后重新打开。`;
    document.getElementById('app').replaceChildren(notice);
    throw error;
  } finally { if (ready) await sdk.lifecycle.ready(); }
}
