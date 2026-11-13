import { getSDK } from './vendor/index.mjs';
import { createPlatformStorage } from './storage.mjs';

export function createPlatformTransport(sdk) {
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
    await render(createPlatformTransport(sdk), { storage, sceneUrl, saveFile: (name, data) => sdk.files.save(name, data) });
  } catch (error) {
    const notice = document.createElement('p');
    notice.setAttribute('role', 'alert');
    notice.textContent = `游戏加载失败：${error.message}。请关闭后重新打开。`;
    document.getElementById('app').replaceChildren(notice);
    throw error;
  } finally { if (ready) await sdk.lifecycle.ready(); }
}
