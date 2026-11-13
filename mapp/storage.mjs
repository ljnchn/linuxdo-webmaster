// The game reads synchronously; destructive actions await confirmed writes.
export async function createPlatformStorage(api) {
  const snapshot = await api.exportData({ timeoutMs: 15_000 });
  const values = new Map(snapshot.entries);
  let pending = Promise.resolve(), failure = null;
  return {
    onError: null,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      if (failure) throw failure;
      values.set(key, String(value));
      pending = pending.then(() => {
        if (failure) return;
        return api.setItem(key, String(value));
      }).catch(error => { failure = error; this.onError?.(error); });
    },
    async flush() {
      await pending;
      if (failure) throw failure;
    },
  };
}
