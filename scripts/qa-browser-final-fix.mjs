import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const out = new URL('../artifacts/qa-gameplay-camera-controls-2026-10-16/', import.meta.url);
const outPath = fileURLToPath(out), artifact = name => path.join(outPath, name);
await fs.mkdir(outPath, { recursive: true });
async function measureFrameWindow(page,durationMs){return page.evaluate(ms=>new Promise(resolve=>{const times=[];let start=0,previous=0;const frame=now=>{if(!start){start=previous=now;}else{times.push(now-previous);previous=now;}if(now-start<ms){requestAnimationFrame(frame);return;}const sorted=[...times].sort((a,b)=>a-b),pct=p=>sorted.length?Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]*10)/10:null,mean=times.length?times.reduce((a,b)=>a+b,0)/times.length:null,s=window.__NAPOLI_QA__?.snapshot?.(),p=s?.performance||{},renderer=s?.state?.renderer||null,w=window.__w3,gl=w?.gl,diag=window.__NAPOLI_RENDER_DIAGNOSTICS__||null;let webgl=null;try{const ext=gl?.getContext()?.getExtension('WEBGL_debug_renderer_info');webgl=gl?{vendor:ext?gl.getContext().getParameter(ext.UNMASKED_VENDOR_WEBGL):null,renderer:ext?gl.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL):null,version:gl.getContext().getParameter(gl.getContext().VERSION),contextAttributes:gl.getContext().getContextAttributes()}:null;}catch{}const renderSamples=w?.renderSamples?Array.from(w.renderSamples.subarray(0,w.renderSampleCount||0)):[],renderSorted=renderSamples.slice().sort((a,b)=>a-b),renderPct=q=>renderSorted.length?Math.round(renderSorted[Math.min(renderSorted.length-1,Math.ceil(renderSorted.length*q)-1)]*10)/10:null;resolve({durationMs:Math.round(now-start),samples:times.length,fps:times.length/Math.max(.001,(now-start)/1000),meanFrameMs:mean?Math.round(mean*10)/10:null,p95FrameMs:pct(.95),p99FrameMs:pct(.99),maxFrameMs:times.length?Math.round(Math.max(...times)*10)/10:null,heapMb:p.heapMb,longTasks:p.longTasks,longAnimationFrames:p.longAnimationFrames,renderer,environment:{hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,visibilityState:document.visibilityState,hidden:document.hidden,userAgent:navigator.userAgent},worldState:w?.cur?{room:w.cur.room,stage:w.cur.stage,phase:w.cur.phase,loading:w.cur.loading}:null,worldRender:{gfx:w?.gfx,mobile:w?.mobile,devicePixelRatio:devicePixelRatio,pixelRatio:gl?.getPixelRatio?.(),toon:w?.toon,shadowMap:gl?.shadowMap?.enabled,lastSubmitMs:w?.lastRenderMs,submitP95Ms:renderPct(.95),submitP99Ms:renderPct(.99),components:diag?Object.fromEntries(Object.entries(diag).map(([name,v])=>[name,{calls:v.calls,meanMs:v.calls?Math.round(v.total/v.calls*10)/10:0,maxMs:Math.round(v.max*10)/10}] )):null},webgl});};requestAnimationFrame(frame);}),durationMs);}
function installRenderDiagnostics(page){return page.evaluate(()=>{const w=window.__w3;if(!w||window.__NAPOLI_RENDER_DIAGNOSTICS__)return false;const diag=window.__NAPOLI_RENDER_DIAGNOSTICS__={};const wrap=(object,key,label=key)=>{const original=object?.[key];if(typeof original!=='function')return;const stat=diag[label]={calls:0,total:0,max:0};object[key]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{const duration=performance.now()-start;stat.calls++;stat.total+=duration;stat.max=Math.max(stat.max,duration);}};};wrap(w,'draw');wrap(w,'present');wrap(w,'city');wrap(w,'minimap');wrap(w,'updateLife');wrap(w,'animRides');wrap(w,'animFx');wrap(w,'magic');wrap(w.gl,'render','webglRender');wrap(w.outline,'render','outlineRender');wrap(w.visibility,'update','visibilityUpdate');wrap(w.collisionIndex,'queryRectInto','cameraCollisionCandidates');wrap(w.ray,'intersectObjects','cameraRaycast');const native=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>callback?.name==='frame'?native(now=>{const start=performance.now();try{return callback(now);}finally{const duration=performance.now()-start,stat=diag.appFrame??(diag.appFrame={calls:0,total:0,max:0});stat.calls++;stat.total+=duration;stat.max=Math.max(stat.max,duration);}}):native(callback);return true;});}
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await context.addInitScript(() => {
  localStorage.setItem('humana-cam', 'first');
  localStorage.setItem('humana-avatar-kind', '2d');
});
const page = await context.newPage();
const pageErrors = [], consoleErrors = [], cityBuildLogs = [], failedRequests = [], vehicleResponses = [], vehicleFinished = [], sockets = [];
page.on('pageerror', error => pageErrors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); else if (message.text().startsWith('[napoli]')) cityBuildLogs.push(message.text()); });
page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
page.on('response', response => { if (/\/vehicles\/.*\.glb(?:\?|$)/i.test(response.url())) vehicleResponses.push({ url: response.url(), status: response.status() }); });
page.on('requestfinished', request => { if (/\/vehicles\/.*\.glb(?:\?|$)/i.test(request.url())) vehicleFinished.push(request.url()); });
page.on('websocket', socket => {
  const item = { url: socket.url(), received: {}, sent: {}, receivedTail: [], sentTail: [], gameplayFrames: [], close: null };
  sockets.push(item);
  const count = (table, tail, frame, direction) => { let message = null, type = 'binary'; try { message = JSON.parse(frame.payload); type = message.type || type; } catch {} table[type] = (table[type] || 0) + 1; tail.push(type); if (tail.length > 8) tail.shift(); if (['interact','notification','error'].includes(type)) { item.gameplayFrames.push({ direction, type, message }); if(item.gameplayFrames.length>30)item.gameplayFrames.shift(); } };
  socket.on('framereceived', frame => count(item.received, item.receivedTail, frame, 'received'));
  socket.on('framesent', frame => count(item.sent, item.sentTail, frame, 'sent'));
  socket.on('close', () => { item.close = 'closed'; });
});

const results = { startedAt: new Date().toISOString(), url: 'http://127.0.0.1:3079/?3d=1&qa=1&v=368', browser: 'Chromium headless; emulated mobile touch; not physical Android' };
await page.goto(results.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.locator('#guest').waitFor({ state: 'visible', timeout: 45000 });
await page.waitForFunction(() => !!window.__NAPOLI_QA__, null, { timeout: 90000 });
await page.locator('#guest').click();
await page.waitForTimeout(3000);
if (!(await page.locator('#modal-body button').count())) {
  await page.screenshot({ path: artifact('guest-picker-state.png'), fullPage: false });
  results.guestPickerFailure = { text: await page.locator('body').innerText(), pageErrors, consoleErrors, failedRequests };
  await fs.writeFile(artifact('report.json'), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  process.exitCode = 1;
} else {
await page.locator('#modal-body button').first().waitFor({ state: 'visible', timeout: 15000 });
await page.locator('#modal-body button').first().click();
await page.locator('#pg-go').waitFor({ state: 'visible', timeout: 60000 });
await page.evaluate(() => {
  const timeline = window.__NAPOLI_QA_WORLD_TIMELINE = { startedAt: performance.now(), readyAt: null, samples: [] };
  const timer = setInterval(() => {
    const z = window.__w3?.cur, sample = {
      at: Math.round(performance.now() - timeline.startedAt), room: z?.room ?? null, stage: z?.stage ?? null, phase: z?.phase ?? null,
      loading: z?.loading ?? null, children: z?.g?.children?.length ?? null,
      visibilityEntries: z?.visibility?.entries?.length ?? null, programs: window.__w3?.gl?.info?.programs?.length ?? null,
      overlayHidden: !!document.querySelector('#scene-loading')?.hidden,
    };
    timeline.samples.push(sample);
    if (timeline.samples.length > 180) timeline.samples.shift();
    if (!timeline.readyAt && sample.room === 'mergellina' && z && !z.loading && !z.error && sample.overlayHidden) timeline.readyAt = performance.now();
    if (timeline.readyAt && performance.now() - timeline.readyAt > 3000) clearInterval(timer);
  }, 500);
});
await page.evaluate(() => { window.__QA_WORLD_ENTRY_AT = performance.now(); });
await page.locator('#pg-go').click();
await page.waitForFunction(() => window.__NAPOLI_QA__?.snapshot?.().state?.player, null, { timeout: 60000 });
await page.waitForTimeout(12000);
results.entry = await page.evaluate(() => ({
  hudVisible: !document.querySelector('#hud').hidden,
  player: window.__NAPOLI_QA__?.snapshot?.().state?.player,
  cameraMode: window.__NAPOLI_QA__?.snapshot?.().state?.camera?.mode,
  avatarPreference: localStorage.getItem('humana-avatar2'),
  cameraPreference: localStorage.getItem('humana-cam'),
  fallbackAvatarHidden: window.__NAPOLI_QA__?.snapshot?.().state?.fallbackAvatarHidden,
  worldLoaded: window.__NAPOLI_QA__?.snapshot?.().state?.world?.loaded,
  avatar: (() => { const p=window.__NAPOLI_QA__?.snapshot?.().state?.player,e=p&&window.__w3?.players?.get(p.id); return e?.body?{visible:e.body.visible,legs:!!e.legs,avatarKind:e.av?.userData?.avatarKind||e.av?.userData?.kind||null,children:e.body.children.length}:null; })(),
}));
await page.screenshot({ path: artifact('walk-844x390.png'), fullPage: false });
await page.waitForTimeout(2500);
results.idlePerformance = await page.evaluate(() => window.__NAPOLI_QA__?.snapshot?.().performance || null);

results.walkInput = await page.evaluate(async () => {
  const qa = window.__NAPOLI_QA__, stick = document.querySelector('#joystick'), run = document.querySelector('#run');
  const before = qa.snapshot().state.player;
  const r = stick.getBoundingClientRect(), x = r.left + r.width * .88, y = r.top + r.height / 2;
  stick.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, pointerType: 'touch', button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  run.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 42, pointerType: 'touch', button: 0, buttons: 1, bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 1800));
  const during = qa.snapshot();
  stick.dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, pointerType: 'touch', button: 0, buttons: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  run.dispatchEvent(new PointerEvent('pointerup', { pointerId: 42, pointerType: 'touch', button: 0, buttons: 0, bubbles: true, cancelable: true }));
  const after = qa.snapshot().state.player;
  return { before: { x: before.x, y: before.y }, duringInput: during.walkInput, performance: during.performance, renderer: during.state?.renderer, after: { x: after.x, y: after.y }, moved: Math.hypot(after.x - before.x, after.y - before.y) > .05 };
});

results.cameraModes = [];
for (let i = 0; i < 3; i++) {
  await page.getByLabel('Cambia telecamera (C)').click({ force: true });
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => {
    const snapshot=window.__NAPOLI_QA__?.snapshot?.(),p=snapshot?.state?.player,e=p&&window.__w3?.players?.get(p.id);
    return { mode:snapshot?.state?.camera?.mode, avatarVisible:e?.body?.visible??null, avatarLegs:!!e?.legs, avatarChildren:e?.body?.children?.length??null, camera:snapshot?.state?.camera||null };
  });
  results.cameraModes.push(state);
  if (state.mode === 'first') await page.screenshot({ path: artifact('camera-first-person-844x390.png'), fullPage: false });
  if (state.mode === 'third') await page.screenshot({ path: artifact('camera-third-person-844x390.png'), fullPage: false });
  if (state.mode === '25d') await page.screenshot({ path: artifact('camera-25d-844x390.png'), fullPage: false });
}

await page.evaluate(() => document.body.classList.add('qa-vehicle-preview'));
await page.waitForTimeout(500);
results.vehicleHud = await page.evaluate(() => {
  const selectors = ['.dh-steer', '[data-drive="gas"]', '[data-drive="brake"]', '.dh-horn', '.dh-off', '.dh-lock', '#minimap', '#joystick', '.actions #phone', '.actions #inventory'];
  const elements = selectors.flatMap(selector => [...document.querySelectorAll(selector)]).filter(element => {
    const s = getComputedStyle(element), r = element.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 4 && r.height > 4;
  });
  const boxes = elements.map(element => { const r = element.getBoundingClientRect(); return { name: element.getAttribute('aria-label') || element.dataset.drive || element.id || element.className, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j], w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)), h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
    if (w * h > 12) overlaps.push({ a: a.name, b: b.name, area: Math.round(w * h) });
  }
  return { bodyClasses: document.body.className, boxes, overlaps };
});
await page.screenshot({ path: artifact('vehicle-hud-844x390.png'), fullPage: false });

results.vehicleMultitouch = await page.evaluate(() => {
  const qa = window.__NAPOLI_QA__, steer = document.querySelector('.dh-steer'), gas = document.querySelector('[data-drive="gas"]'), brake = document.querySelector('[data-drive="brake"]');
  const center = element => { const r = element.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const dispatch = (el, type, id, p) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: p.x, clientY: p.y, bubbles: true, cancelable: true }));
  const s = center(steer), g = center(gas), b = center(brake);
  dispatch(steer, 'pointerdown', 51, { x: s.x + 20, y: s.y }); dispatch(gas, 'pointerdown', 52, g);
  const two = qa.snapshot().vehicleInput;
  dispatch(brake, 'pointerdown', 53, b); const three = qa.snapshot().vehicleInput;
  dispatch(brake, 'pointerup', 53, b); dispatch(gas, 'pointerup', 52, g); dispatch(steer, 'pointerup', 51, s);
  const released = qa.snapshot().vehicleInput;
  return { twoFingerSteerGas: two, threeFingerBrake: three, released, passed: two?.pointers?.length === 2 && two.values?.throttle === 1 && three?.pointers?.length === 3 && three.values?.brake === 1 && released?.pointers?.length === 0 };
});
await page.setViewportSize({ width: 915, height: 412 });
await page.waitForTimeout(300);
results.vehicleHud915x412 = await page.evaluate(() => {
  const selectors = ['.dh-steer', '[data-drive="gas"]', '[data-drive="brake"]', '.dh-horn', '.dh-off', '.dh-lock', '#minimap', '#joystick', '.actions #phone', '.actions #inventory'];
  const elements = selectors.flatMap(selector => [...document.querySelectorAll(selector)]).filter(element => {
    const s = getComputedStyle(element), r = element.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 4 && r.height > 4;
  });
  const boxes = elements.map(element => { const r = element.getBoundingClientRect(); return { name: element.getAttribute('aria-label') || element.dataset.drive || element.id || element.className, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j], w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)), h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
    if (w * h > 12) overlaps.push({ a: a.name, b: b.name, area: Math.round(w * h) });
  }
  return { viewport: { width: innerWidth, height: innerHeight }, boxes, overlaps };
});
await page.screenshot({ path: artifact('vehicle-hud-915x412.png'), fullPage: false });
await page.setViewportSize({ width: 932, height: 430 });
await page.waitForTimeout(500);
await page.screenshot({ path: artifact('vehicle-hud-932x430.png'), fullPage: false });
results.vehicleHud932x430 = await page.evaluate(() => {
  const selectors=['.dh-steer','[data-drive="gas"]','[data-drive="brake"]','.dh-horn','.dh-off','.dh-lock','#minimap','#joystick','.actions #phone','.actions #inventory','.social','#settings','#cam3d'];
  const elements=selectors.flatMap(selector=>[...document.querySelectorAll(selector)]).filter(element=>{const s=getComputedStyle(element),r=element.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>4&&r.height>4;});
  const boxes=elements.map(element=>{const r=element.getBoundingClientRect();return{name:element.getAttribute('aria-label')||element.dataset.drive||element.id||element.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}),overlaps=[];
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j],w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));if(w*h>12)overlaps.push({a:a.name,b:b.name,area:Math.round(w*h)});}
  return{viewport:{width:innerWidth,height:innerHeight},boxes,overlaps};
});
await page.evaluate(() => document.body.classList.remove('qa-vehicle-preview'));
await page.waitForTimeout(350);
results.footHudAfterPreview = await page.evaluate(() => {
  const shown=selector=>{const element=document.querySelector(selector);return !!element&&!element.closest('[hidden]')&&getComputedStyle(element).display!=='none'&&getComputedStyle(element).visibility!=='hidden'&&Number(getComputedStyle(element).opacity)>0&&element.getBoundingClientRect().width>4&&element.getBoundingClientRect().height>4;};
  const interact=document.querySelector('#interact'),interactionAvailable=!!interact?.classList.contains('available');
  const state={viewport:{width:innerWidth,height:innerHeight},bodyClasses:document.body.className,joystick:shown('#joystick'),run:shown('#run'),interaction:shown('#interact'),interactionAvailable,driveControls:shown('.drive-controls'),driveHud:shown('#drive-hud')};
  // Contextual interaction is intentionally hidden when no nearby target exists.
  // Test the foot HUD mode independently from whether the player is in interaction range.
  state.passed=state.joystick&&state.run&&!state.driveControls&&!state.driveHud;
  return state;
});
await page.screenshot({path:artifact('foot-hud-after-preview-932x430.png'),fullPage:false});
results.worldLoadProgress = [];
for (let i = 0; i < 60; i++) {
  const status = await page.evaluate(() => {
    const z = window.__w3?.cur;
    return z ? { room: z.room, stage: z.stage, phase: z.phase, loading: z.loading, slow: z.slow, error: z.error ? String(z.error.message || z.error) : null, children: z.g?.children?.length, zoneCount: window.__w3?.zones?.size, visibilityEntries: z.visibility?.entries?.length ?? null, graphicsPrograms: window.__w3?.gl?.info?.programs?.length, overlayHidden:document.querySelector('#scene-loading')?.hidden, canvasVisible:window.__w3?.canvas?.style.display==='block', cameraInputActive:!!window.__w3?.active } : null;
  });
  results.worldLoadProgress.push(status);
  if (status && !status.loading && !status.error && status.overlayHidden) break;
  await page.waitForTimeout(3000);
}
results.worldFinal = await page.evaluate(() => {
  const z = window.__w3?.cur;
  return z ? { room: z.room, stage: z.stage, phase: z.phase, loading: z.loading, slow: z.slow, error: z.error ? String(z.error.message || z.error) : null, children: z.g?.children?.length, visibilityEntries: z.visibility?.entries?.length ?? null, optionalWarmup:z.optionalWarmup||null, textureWarmup:z.textureWarmup||null, characterWarmup:z.characterWarmup||null, avatarChoice: localStorage.getItem('humana-avatar2'), loadingOverlayHidden: document.querySelector('#scene-loading')?.hidden, canvasVisible:window.__w3?.canvas?.style.display==='block', cameraInputActive:!!window.__w3?.active } : null;
});
results.worldReadyPerfMs = await page.evaluate(()=>performance.now());
results.worldPreparationTimeline = await page.evaluate(() => {
  const t = window.__NAPOLI_QA_WORLD_TIMELINE;
  return t ? { elapsedMs: Math.round(performance.now() - window.__QA_WORLD_ENTRY_AT), readyAfterMs: t.readyAt ? Math.round(t.readyAt - window.__QA_WORLD_ENTRY_AT) : null, samples: t.samples } : null;
});
await page.waitForFunction(() => !!window.__w3?.realVehicleLoad, null, { timeout: 90000 });
results.realVehicleLoadSettled = await page.evaluate(async () => {
  const pending=window.__w3?.realVehicleLoad;
  if(!pending)return false;
  return await Promise.race([pending.then(()=>true,()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),30000))]);
});
results.realVehicleAssets = await page.evaluate(() => ({
  status:window.__w3?.realVehicleStatus||null,
  loadedKeys:Object.keys(window.__w3?.realV||{}),
  mobile:!!window.__w3?.mobile,
}));
results.renderDiagnosticsInstalled=await installRenderDiagnostics(page);
await page.waitForTimeout(2000);
results.steadyIdlePerformance = await measureFrameWindow(page,10000);
results.worldReadyElapsedSeconds = Math.round((results.worldPreparationTimeline?.readyAfterMs??results.worldReadyPerfMs)/1000*10)/10;
results.longTasksAfterWorldReady = (results.steadyIdlePerformance.longTasks||[]).filter(task=>task.start>=results.worldReadyPerfMs);
results.longAnimationFramesAfterWorldReady = (results.steadyIdlePerformance.longAnimationFrames||[]).filter(frame=>frame.start+frame.duration>=results.worldReadyPerfMs);
await page.screenshot({ path: artifact('world-after-wait-932x430.png'), fullPage: false });
results.actualVehicleProbe = await page.evaluate(() => window.__NAPOLI_QA__?.inspectInteraction?.());
const vehicleTarget = results.actualVehicleProbe?.nearbyVehicles?.filter(item => !item.occupied).sort((a, b) => a.distance - b.distance)[0];
if (vehicleTarget && vehicleTarget.distance < 160) {
  const player = results.actualVehicleProbe.player, safeDistance = 3.2, walkPoint = { x: vehicleTarget.x + (player.x - vehicleTarget.x) * (safeDistance / vehicleTarget.distance), y: vehicleTarget.y + (player.y - vehicleTarget.y) * (safeDistance / vehicleTarget.distance) };
  results.approachTest = { vehicleId: vehicleTarget.id, vehicleDistance: vehicleTarget.distance, walkPoint, accepted: await page.evaluate(({ x, y }) => window.__NAPOLI_QA__?.walkTo?.(x, y), walkPoint), samples: [] };
  results.approachTest.startedAt = Date.now();
  const approachDeadline = Date.now() + 90000;
  while (Date.now() < approachDeadline) {
    const state = await page.evaluate(id => {
      const qa=window.__NAPOLI_QA__,p=qa?.snapshot?.().state?.player,i=qa?.inspectInteraction?.(),v=i?.nearbyVehicles?.find(q=>q.id===id);
      return { player:p?{x:p.x,y:p.y}:null, distance:v?.distance??null, walking:qa?.snapshot?.().walkInput||null, hint:document.querySelector('#nearby-hint')?.textContent||'' };
    }, vehicleTarget.id);
    results.approachTest.samples.push({ atMs: Date.now() - results.approachTest.startedAt, ...state });
    if (state.distance !== null && state.distance <= 4.2) break;
    await page.waitForTimeout(2000);
  }
  results.approachTest.playerAfterWalk = await page.evaluate(() => window.__NAPOLI_QA__?.snapshot?.().state?.player);
  results.approachTest.finalDistance = await page.evaluate(id => window.__NAPOLI_QA__?.inspectInteraction?.()?.nearbyVehicles?.find(item=>item.id===id)?.distance ?? null, vehicleTarget.id);
  results.approachTest.arrived = results.approachTest.finalDistance !== null && results.approachTest.finalDistance <= 4.2;
  if (results.approachTest.arrived) {
    try { await page.waitForFunction(() => document.querySelector('#interact')?.classList.contains('available'), null, { timeout: 12000 }); }
    catch { results.approachTest.interactionButtonDidNotActivate = await page.evaluate(() => ({ hint: document.querySelector('#nearby-hint')?.textContent, className: document.querySelector('#interact')?.className })); }
    await page.evaluate(() => {
      const button=document.querySelector('#interact');if(!button)return false;
      const r=button.getBoundingClientRect(),init={pointerId:71,pointerType:'touch',button:0,clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true,cancelable:true};
      button.dispatchEvent(new PointerEvent('pointerdown',{...init,buttons:1}));
      button.dispatchEvent(new PointerEvent('pointerup',{...init,buttons:0}));return true;
    });
  }
  try {
    if (!results.approachTest.arrived) throw new Error('Il personaggio non è arrivato entro il raggio d’interazione dopo 90 s');
    await page.waitForFunction(() => !!window.__NAPOLI_QA__?.snapshot?.().state?.player?.vehicle, null, { timeout: 30000 });
    results.actualVehicleMount = await page.evaluate(() => ({ player: window.__NAPOLI_QA__.snapshot().state.player, bodyClasses: document.body.className, camera: window.__NAPOLI_QA__.snapshot().state.camera }));
    results.motoCameraModes=[];
    for(let i=0;i<3;i++){
      if(i)await page.getByLabel('Cambia telecamera (C)').click({force:true});
      await page.waitForTimeout(300);
      results.motoCameraModes.push(await page.evaluate(()=>({mode:window.__NAPOLI_QA__?.snapshot?.().state?.camera?.mode,motoCockpitVisible:!!window.__w3?.motoCock?.visible,carDashboardVisible:!!window.__w3?.dash?.visible,carCockpitUiVisible:!!document.querySelector('#cockpit')&&!document.querySelector('#cockpit').hidden})));
      if(results.motoCameraModes.at(-1).mode==='moto-cockpit')await page.screenshot({path:artifact('moto-cockpit-932x430.png'),fullPage:false});
    }
    results.motoCameraModesPassed=results.motoCameraModes.some(item=>item.mode==='moto-cockpit'&&item.motoCockpitVisible&&!item.carDashboardVisible&&!item.carCockpitUiVisible)&&results.motoCameraModes.some(item=>item.mode==='moto-orbit')&&results.motoCameraModes.some(item=>item.mode==='moto-chase');
    await page.getByLabel('Cambia telecamera (C)').click({force:true});
    await page.waitForTimeout(300);
    await page.screenshot({path:artifact('moto-chase-932x430.png'),fullPage:false});
    results.actualVehicleDrive = await page.evaluate(async () => {
      const qa = window.__NAPOLI_QA__, steer = document.querySelector('.dh-steer'), gas = document.querySelector('[data-drive="gas"]');
      const r = steer.getBoundingClientRect(), g = gas.getBoundingClientRect(), p1 = { x: r.left + r.width * .75, y: r.top + r.height / 2 }, p2 = { x: g.left + g.width / 2, y: g.top + g.height / 2 }, before = qa.snapshot().state.player;
      const dispatch = (el, type, id, p) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: p.x, clientY: p.y, bubbles: true, cancelable: true }));
      dispatch(steer, 'pointerdown', 61, p1); dispatch(gas, 'pointerdown', 62, p2);
      const cameraCanvas=document.querySelector('#world3d'), cameraPoint={x:innerWidth*.68,y:innerHeight*.45}, yawBefore=window.__w3?.yaw??0;
      dispatch(cameraCanvas,'pointerdown',63,cameraPoint);
      window.dispatchEvent(new PointerEvent('pointermove',{pointerId:63,pointerType:'touch',button:0,buttons:1,clientX:cameraPoint.x+52,clientY:cameraPoint.y+8,bubbles:true,cancelable:true}));
      await new Promise(resolve=>setTimeout(resolve,350));
      const yawAfter=window.__w3?.yaw??yawBefore,cameraTouch={yawBefore,yawAfter,yawDelta:yawAfter-yawBefore,changed:Math.abs(yawAfter-yawBefore)>.05};
      dispatch(window,'pointerup',63,{x:cameraPoint.x+52,y:cameraPoint.y+8});
      const samples=[];let start=0,previous=0;await new Promise(resolve=>{const frame=now=>{if(!start)start=previous=now;else{samples.push(now-previous);previous=now;}if(now-start<8000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
      const during=qa.snapshot();dispatch(gas,'pointerup',62,p2);dispatch(steer,'pointerup',61,p1);await new Promise(resolve=>setTimeout(resolve,500));
      const sorted=[...samples].sort((a,b)=>a-b),pct=p=>sorted.length?Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]*10)/10:null,mean=samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:null,after=qa.snapshot().state.player;
      const w=window.__w3,e=w?.players?.get(before.id),car=e?.car,collision=w?.cameraHits?.[0],cameraDiag=w?.cameraRaycastDiagnostics;
      return {before,during:during.state?.player,input:during.vehicleInput,cameraTouch,cameraCollision:{position:w?.camera?.position?{x:+w.camera.position.x.toFixed(2),y:+w.camera.position.y.toFixed(2),z:+w.camera.position.z.toFixed(2)}:null,rayHitCount:cameraDiag?.hitDistance!==undefined&&cameraDiag?.hitDistance!==null?1:(w?.cameraHits?.length||0),firstHitDistance:Number.isFinite(cameraDiag?.hitDistance)?+cameraDiag.hitDistance.toFixed(2):Number.isFinite(collision?.distance)?+collision.distance.toFixed(2):null,buildingName:cameraDiag?.buildingName??null,candidates:cameraDiag?.candidates??null,total:cameraDiag?.total??null},vehicleVisual:{carVisible:car?.visible??null,carName:car?.name??null,carPosition:car?{x:+car.position.x.toFixed(2),y:+car.position.y.toFixed(2),z:+car.position.z.toFixed(2)}:null},performance:during.performance,renderer:during.state?.renderer,performanceWindow:{durationMs:Math.round(samples.reduce((a,b)=>a+b,0)),samples:samples.length,fps:samples.length/Math.max(.001,samples.reduce((a,b)=>a+b,0)/1000),meanFrameMs:mean?Math.round(mean*10)/10:null,p95FrameMs:pct(.95),p99FrameMs:pct(.99),maxFrameMs:samples.length?Math.round(Math.max(...samples)*10)/10:null,heapMb:performance.memory?.usedJSHeapSize?Math.round(performance.memory.usedJSHeapSize/104857.6)/10:null},after,moved:Math.hypot(after.x-before.x,after.y-before.y)>.1};
    });
    await page.screenshot({ path: artifact('actual-vehicle-mounted-932x430.png'), fullPage: false });
    await page.locator('.dh-off').click({ force: true });
    await page.waitForFunction(() => !window.__NAPOLI_QA__?.snapshot?.().state?.player?.vehicle, null, { timeout: 12000 });
    results.actualVehicleExit = true;
  } catch {
    results.actualVehicleMount ??= await page.evaluate(() => ({ player: window.__NAPOLI_QA__?.snapshot?.().state?.player, hint: document.querySelector('#nearby-hint')?.textContent, interactions: window.__NAPOLI_QA__?.snapshot?.().interactions?.slice(-8) }));
  }
} else results.actualVehicleMount = { skipped: 'Nessun veicolo non occupato entro 160 m', nearest: vehicleTarget || null };
const modelPreview=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const previewErrors=[],previewResponses=[];
modelPreview.on('pageerror',error=>previewErrors.push(String(error)));
modelPreview.on('console',message=>{if(message.type()==='error')previewErrors.push(message.text());});
modelPreview.on('response',response=>{if(/\/vehicles\/(?:auto-vere\/sportscar|moto-vere\/africa)\.glb(?:\?|$)/i.test(response.url()))previewResponses.push({url:response.url(),status:response.status()});});
await modelPreview.goto('http://127.0.0.1:3079/vetrina-moto.html?real=1',{waitUntil:'domcontentloaded',timeout:45000});
await modelPreview.waitForFunction(()=>document.title==='ok',null,{timeout:60000});
await modelPreview.waitForTimeout(500);
await modelPreview.screenshot({path:artifact('real-vehicle-glb-showcase-1280x720.png'),fullPage:false});
results.realVehicleVisualPreview={title:await modelPreview.title(),responses:previewResponses,errors:previewErrors,viewport:await modelPreview.evaluate(()=>({width:innerWidth,height:innerHeight}))};
await modelPreview.close();
results.pageErrors = pageErrors;
results.consoleErrors = consoleErrors.slice(0, 30);
results.cityBuildLogs = cityBuildLogs;
results.failedRequests = failedRequests.slice(0, 30);
results.vehicleModelRequests = { responses:vehicleResponses, finished:vehicleFinished, failed:failedRequests.filter(item=>/\/vehicles\/.*\.glb(?:\?|$)/i.test(item.url)) };
results.webSockets = sockets;
const cameraModes=new Set(results.cameraModes.map(state=>state.mode));
const glbFailures=results.vehicleModelRequests.failed.length;
results.validation={
  worldReady:results.worldFinal?.error===null&&results.worldFinal?.loading===false,
  avatarVisibleThirdPerson:results.cameraModes.some(state=>state.mode==='third'&&state.avatarVisible===true&&state.avatarLegs),
  avatarHiddenFirstPerson:results.cameraModes.some(state=>state.mode==='first'&&state.avatarVisible===false),
  allWalkCamerasTested:['first','third','25d'].every(mode=>cameraModes.has(mode)),
  walkingMoved:!!results.walkInput?.moved,
  vehicleMounted:!!results.actualVehicleMount?.player?.vehicle,
  vehicleDrove:!!results.actualVehicleDrive?.moved,
  vehicleExited:!!results.actualVehicleExit,
  motoSpecificCamera:!!results.motoCameraModesPassed,
  cameraTouchWhileSteeringAndAccelerating:!!results.actualVehicleDrive?.cameraTouch?.changed&&!!results.actualVehicleDrive?.moved,
  cameraOcclusionIndexReady:(results.actualVehicleDrive?.cameraCollision?.total||0)>0,
  multitouch:!!results.vehicleMultitouch?.passed,
  footHudRestored:!!results.footHudAfterPreview?.passed,
  vehicleHudNoOverlap:['vehicleHud','vehicleHud915x412','vehicleHud932x430'].every(key=>(results[key]?.overlaps||[]).length===0),
  realModelLoadSettled:!!results.realVehicleLoadSettled,
  expectedMobileModelPolicy:results.realVehicleAssets?.mobile&&results.realVehicleAssets?.loadedKeys?.includes('sportscar')&&results.realVehicleAssets?.status?.skipped?.some(item=>item.id==='africa'),
  postLoadMeasurementAvailable:(results.steadyIdlePerformance?.samples||0)>0,
  noAbortedVehicleModels:glbFailures===0,
  realGlbModelsVisuallyLoaded:['auto-vere/sportscar.glb','moto-vere/africa.glb'].every(path=>results.realVehicleVisualPreview?.responses?.some(response=>response.status===200&&response.url.includes(path)))&&results.realVehicleVisualPreview?.errors?.length===0,
  noPageOrConsoleErrors:pageErrors.length===0&&consoleErrors.length===0,
};
results.validation.passed=Object.values(results.validation).every(Boolean);
results.finishedAt = new Date().toISOString();
await fs.writeFile(artifact('report.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ output: outPath, results }, null, 2));
await browser.close();
if(!results.validation.passed)process.exitCode=1;
}
