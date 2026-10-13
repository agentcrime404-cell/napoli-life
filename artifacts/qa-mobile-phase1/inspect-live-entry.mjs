import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:3181';
const outDir = 'artifacts/qa-mobile-phase1';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const errors = [];
const badResponses = [];
let context;
try {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, recordVideo: { dir: `${outDir}/videos` } });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() }); });

  const authResponse = await context.request.post(`${baseURL}/api/auth/guest`, { data: { look: 0 } });
  const guest = await authResponse.json();
  await page.addInitScript(token => { try { localStorage.setItem('humana-token', token); } catch {} }, guest.token);
  const dashboardResponse = await page.goto(`${baseURL}/debug-controls`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const gameFrame = page.frameLocator('#game-frame');
  await gameFrame.locator('#pg-go').waitFor({ state: 'attached', timeout: 45000 });
  await page.waitForTimeout(4000);

  const beforeEntry = await gameFrame.locator('body').evaluate(body => {
    const w = window;
    return { url: location.href, title: document.title, body: body.innerText.slice(0, 800), pregame: w.__pregame, qa: !!w.__NAPOLI_QA__, auth: !!w.localStorage?.getItem('humana-token'), canvas: !!document.querySelector('canvas') };
  });
  await page.screenshot({ path: `${outDir}/live-entry-390x844.png`, fullPage: true, animations: 'disabled' });

  await gameFrame.locator('#pg-go').click({ timeout: 12000, force: true });
  await page.waitForTimeout(12000);
  const frames = page.frames();
  const gameContext = frames.find(frame => frame.url().includes('qa=1')) || frames.find(frame => /\/$/.test(new URL(frame.url()).pathname));
  const afterEntry = gameContext ? await gameContext.evaluate(() => {
    const w = window, d = document, qa = w.__NAPOLI_QA__;
    return { url: location.href, title: d.title, body: d.body?.innerText?.slice(0, 800), pregame: w.__pregame, qa: !!qa, snapshot: qa?.snapshot?.() || null, canvas: [...d.querySelectorAll('canvas')].map(c => ({ id: c.id, width: c.width, height: c.height, rect: c.getBoundingClientRect().toJSON() })), renderer: !!w.world3d, fps: d.querySelector('#fps')?.textContent || null };
  }) : null;

  await page.screenshot({ path: `${outDir}/game-after-entry-390x844.png`, fullPage: true, animations: 'disabled' });
  await page.waitForTimeout(1000);
  const report = { dashboardHttp: dashboardResponse.status(), account: guest.user?.username, topUrlAfterEntry: page.url(), frameUrls: frames.map(frame => frame.url()), beforeEntry, afterEntry, badResponses, errors };
  await fs.writeFile(`${outDir}/live-entry-inspection.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (context) await context.close();
  await browser.close();
}
