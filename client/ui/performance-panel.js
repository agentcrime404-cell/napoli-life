export function framePercentile(samples, percentile = .95) {
 const values = Array.from(samples || []).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
 if (!values.length) return null;
 return Math.round(values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentile) - 1))] * 10) / 10;
}

export function browserMemory(performanceApi = globalThis.performance, navigatorApi = globalThis.navigator) {
 const memory = performanceApi?.memory;
 const used = Number(memory?.usedJSHeapSize), limit = Number(memory?.jsHeapSizeLimit);
 return {
  heapFreeMb: Number.isFinite(used) && Number.isFinite(limit) && limit >= used ? Math.round((limit - used) / 1048576 * 10) / 10 : null,
  heapUsedMb: Number.isFinite(used) ? Math.round(used / 1048576 * 10) / 10 : null,
  deviceRamGbEstimate: Number.isFinite(Number(navigatorApi?.deviceMemory)) ? Number(navigatorApi.deviceMemory) : null
 };
}

export function installPerformancePanel() {
 if (!globalThis.window || !globalThis.document || !window.HUMANA_3D || new URLSearchParams(location.search).get('diag') !== '1') return null;

 const stylesheet = document.createElement('link');
 stylesheet.rel = 'stylesheet';
 stylesheet.href = '/ui/performance-panel.css';
 document.head.append(stylesheet);
 const root = document.createElement('section');
 root.id = 'napoli-performance-panel';
 root.className = 'napoli-performance-panel';
 root.hidden = true;
 root.setAttribute('aria-label', 'Diagnostica prestazioni Napoli Life');
 root.innerHTML = '<header><strong>Diagnostica live</strong><span>locale</span></header><dl><div><dt>FPS reali</dt><dd data-metric="fps">—</dd></div><div><dt>Frame time P95</dt><dd data-metric="p95">—</dd></div><div><dt>Frame time P99</dt><dd data-metric="p99">—</dd></div><div><dt>Picco frame time</dt><dd data-metric="peak">—</dd></div><div><dt>Draw call</dt><dd data-metric="calls">—</dd></div><div><dt>Triangoli</dt><dd data-metric="triangles">—</dd></div><div><dt>Heap JS libera</dt><dd data-metric="heap">—</dd></div><div><dt>RAM dispositivo</dt><dd data-metric="ram">—</dd></div></dl><small data-metric="note">P95/P99 e picco sugli ultimi 120 frame; la RAM è una stima.</small>';
 const toggle = document.createElement('button');
 toggle.id = 'napoli-performance-toggle';
 toggle.className = 'napoli-performance-toggle';
 toggle.type = 'button';
 toggle.textContent = 'DIAG';
 toggle.setAttribute('aria-label', 'Apri diagnostica prestazioni');
 toggle.setAttribute('aria-expanded', 'false');
 document.body.append(root, toggle);

 const cells = Object.fromEntries([...root.querySelectorAll('[data-metric]')].map(node => [node.dataset.metric, node]));
 const intervals = new Float32Array(120);
 let intervalCount = 0, intervalWrite = 0, previous = 0;
 let fpsWindowStart = 0, fpsWindowFrames = 0, fps = null, open = false, lastUiUpdate = 0;
 const fmt = (value, unit = '') => Number.isFinite(value) ? `${value}${unit}` : 'n/d';
 const setOpen = value => {
  open = !!value;
  root.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Chiudi diagnostica prestazioni' : 'Apri diagnostica prestazioni');
  toggle.textContent = open ? 'CHIUDI' : 'DIAG';
 };
 toggle.addEventListener('click', () => setOpen(!open));
 addEventListener('keydown', event => { if (event.key === 'F8' && !event.repeat) { event.preventDefault(); setOpen(!open); } });
 document.addEventListener('visibilitychange', () => { previous = 0; fpsWindowStart = 0; fpsWindowFrames = 0; });

 const api = {
  enabled: true,
  toggle: setOpen,
  snapshot(renderer = null) {
   const ordered = new Float32Array(intervalCount);
   for (let i = 0; i < intervalCount; i++) ordered[i] = intervals[(intervalWrite - intervalCount + i + intervals.length) % intervals.length];
   const memory = browserMemory();
   return {
    fps,
    frameTimeP95Ms: framePercentile(ordered),
    frameTimeP99Ms: framePercentile(ordered, .99),
    frameTimeMaxMs: ordered.length ? Math.round(Math.max(...ordered) * 10) / 10 : null,
    drawCalls: Number.isFinite(renderer?.info?.render?.calls) ? renderer.info.render.calls : null,
    triangles: Number.isFinite(renderer?.info?.render?.triangles) ? renderer.info.render.triangles : null,
    ...memory,
    memoryNote: memory.heapFreeMb === null ? 'Heap JS non esposta dal browser' : 'Heap libera rispetto al limite JS del browser'
   };
  },
  sample(now, renderer = null) {
   if (previous > 0) {
    const delta = now - previous;
    if (delta > 0) { intervals[intervalWrite] = delta; intervalWrite = (intervalWrite + 1) % intervals.length; intervalCount = Math.min(intervals.length, intervalCount + 1); fpsWindowFrames++; }
   }
   previous = now;
   if (!fpsWindowStart) fpsWindowStart = now;
   const windowDuration = now - fpsWindowStart;
   if (windowDuration >= 1000) { fps = Math.round(fpsWindowFrames * 1000 / windowDuration * 10) / 10; fpsWindowStart = now; fpsWindowFrames = 0; }
   if (!open || now - lastUiUpdate < 500) return;
   lastUiUpdate = now;
   const state = api.snapshot(renderer), ram = state.deviceRamGbEstimate;
   cells.fps.textContent = fmt(state.fps);
   cells.p95.textContent = fmt(state.frameTimeP95Ms, ' ms');
   cells.p99.textContent = fmt(state.frameTimeP99Ms, ' ms');
   cells.peak.textContent = fmt(state.frameTimeMaxMs, ' ms');
   cells.calls.textContent = fmt(state.drawCalls);
   cells.triangles.textContent = Number.isFinite(state.triangles) ? state.triangles.toLocaleString('it-IT') : 'n/d';
   cells.heap.textContent = state.heapFreeMb === null ? 'n/d' : `${fmt(state.heapFreeMb, ' MB')} liberi`;
   cells.ram.textContent = ram === null ? 'n/d' : `~${fmt(ram, ' GB')} totali`;
 cells.note.textContent = state.heapFreeMb === null ? 'Heap JS non esposta; RAM dispositivo non disponibile.' : 'Heap JS libera entro il limite browser; RAM totale stimata.';
  }
 };
 window.__NAPOLI_DIAGNOSTICS__ = api;
 return api;
}
