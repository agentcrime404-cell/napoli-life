// Preferisce 60 FPS sui telefoni ad alte prestazioni, mantenendo 30 FPS come
// impostazione prudente sui dispositivi per i quali il browser non espone dati.
export function defaultFrameRateLimit(navigatorApi = globalThis.navigator, coarsePointer = globalThis.matchMedia?.('(pointer: coarse)')?.matches ?? false) {
 if (!coarsePointer) return 60;
 const cores = Number(navigatorApi?.hardwareConcurrency) || 0;
 const memory = Number(navigatorApi?.deviceMemory) || 0;
 return cores >= 8 && memory >= 6 ? 60 : 30;
}

export function readFrameRateLimit(storage, navigatorApi = globalThis.navigator, coarsePointer) {
 try {
  const saved = Number((storage ?? globalThis.localStorage)?.getItem('humana-fps-limit'));
  if (saved === 30 || saved === 60) return saved;
 } catch {}
 return defaultFrameRateLimit(navigatorApi, coarsePointer);
}
