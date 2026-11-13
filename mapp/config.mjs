export function configureManifest(template, { publicOrigin = 'https://linux-do-webmaster.rmb.run' } = {}) {
  const manifest = structuredClone(template);
  const origin = new URL(publicOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || /^(localhost\.?|127\..*|\[::1\]|(?:.*\.)?example(?:\..*)?)$/.test(origin.hostname)) {
    throw new Error('PUBLIC_ORIGIN 必须是实际后端的 HTTPS origin（不含路径、凭据、查询或片段）');
  }
  manifest.permissions.push('user.read', 'network.request');
  manifest.endpoints = {
    getState: { url: `${origin.origin}/api/state`, method: 'GET', auth: 'platform' },
    sendAction: { url: `${origin.origin}/api/actions`, method: 'POST', auth: 'platform' },
    getLeaderboard: { url: `${origin.origin}/api/leaderboard`, method: 'GET', query: ['sort'], auth: 'platform' },
  };
  return manifest;
}
