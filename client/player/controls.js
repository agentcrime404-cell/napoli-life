export class Controls {
 constructor(joystick, run, interact, jump = () => {}) {
  this.keys = new Set();
  this.vector = {x: 0, y: 0};
  this.running = false;
  this.pointer = null;
  this.enabled = true;
  this.runPointer = null;
  this.runPointerPrevious = false;

  const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  const syncRunState = active => {
   this.running = !!active;
   run.classList.toggle('active', this.running);
   run.setAttribute('aria-pressed', String(this.running));
   const label = this.running
    ? 'Corsa automatica attiva; tocca per fermarti'
    : 'Attiva la corsa automatica';
   run.setAttribute('aria-label', label);
   run.title = label;
  };

  addEventListener('keydown', e => {
   if (typing() || !this.enabled) return;
   if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyE', 'Space'].includes(e.code)) e.preventDefault();
   this.keys.add(e.code);
   if (e.code === 'KeyE' && !e.repeat) interact();
   if (e.code === 'Space' && !e.repeat) jump();
  });
  addEventListener('keyup', e => this.keys.delete(e.code));
  addEventListener('blur', () => this.reset());
  document.addEventListener('focusin', () => { if (typing()) this.reset(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });

  const move = (e, rect) => {
   let x = (e.clientX - rect.x - rect.width / 2) / (rect.width * .32);
   let y = (e.clientY - rect.y - rect.height / 2) / (rect.height * .32);
   const length = Math.max(1, Math.hypot(x, y));
   x /= length;
   y /= length;
   this.vector = {x, y};
   joystick.firstElementChild.style.transform = `translate(${x * rect.width * .24}px,${y * rect.height * .24}px)`;
  };

  joystick.onpointerdown = e => {
   if (!this.enabled || this.pointer !== null) return;
   e.preventDefault();
   e.stopPropagation();
   this.pointer = e.pointerId;
   this.joystickBounds = joystick.getBoundingClientRect();
   try { joystick.setPointerCapture(e.pointerId); } catch {}
   move(e, this.joystickBounds);
  };
  joystick.onpointermove = e => {
   if (e.pointerId !== this.pointer) return;
   e.preventDefault();
   move(e, this.joystickBounds);
  };
  const releaseJoystick = e => {
   if (e.pointerId !== this.pointer) return;
   e.preventDefault?.();
   this.pointer = null;
   this.joystickBounds = null;
   this.vector = {x: 0, y: 0};
   joystick.firstElementChild.style.transform = '';
  };
  joystick.onpointerup = releaseJoystick;
  joystick.onpointercancel = releaseJoystick;
  joystick.onlostpointercapture = releaseJoystick;

  // Sprint is a toggle: pointerup ends the touch, but leaves sprint enabled.
  // This frees the right thumb to drag on the world and orbit the camera.
  run.onpointerdown = e => {
   if (!this.enabled || this.runPointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
   e.preventDefault();
   e.stopPropagation();
   this.runPointer = e.pointerId;
   this.runPointerPrevious = this.running;
   syncRunState(!this.running);
   try { run.setPointerCapture(e.pointerId); } catch {}
  };
  run.onpointerup = e => {
   if (e.pointerId !== this.runPointer) return;
   this.runPointer = null;
   this.runPointerPrevious = this.running;
  };
  const cancelRunPress = e => {
   if (e.pointerId !== this.runPointer) return;
   syncRunState(this.runPointerPrevious);
   this.runPointer = null;
   this.runPointerPrevious = this.running;
  };
  run.onpointercancel = cancelRunPress;
  run.onlostpointercapture = cancelRunPress;

  this.joystick = joystick;
  this.runButton = run;
  this.jumpButton = jump;
  syncRunState(false);
 }

 reset() {
  const joystickPointer = this.pointer;
  const runPointer = this.runPointer;
  this.keys.clear();
  this.vector = {x: 0, y: 0};
  this.pointer = null;
  this.runPointer = null;
  this.runPointerPrevious = false;
  this.joystickBounds = null;
  this.running = false;
  if (this.joystick) {
   this.joystick.firstElementChild.style.transform = '';
   try {
    if (joystickPointer !== null && this.joystick.hasPointerCapture(joystickPointer)) this.joystick.releasePointerCapture(joystickPointer);
   } catch {}
  }
  if (this.runButton) {
   this.runButton.classList.remove('active');
   this.runButton.setAttribute('aria-pressed', 'false');
   const label = 'Attiva la corsa automatica';
   this.runButton.setAttribute('aria-label', label);
   this.runButton.title = label;
   try {
    if (runPointer !== null && this.runButton.hasPointerCapture(runPointer)) this.runButton.releasePointerCapture(runPointer);
   } catch {}
  }
 }

 input() {
  if (!this.enabled) return {x: 0, y: 0, run: false};
  const sx = this.vector.x + ((this.keys.has('KeyD') || this.keys.has('ArrowRight')) ? 1 : 0) - ((this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ? 1 : 0);
  const sy = this.vector.y + ((this.keys.has('KeyS') || this.keys.has('ArrowDown')) ? 1 : 0) - ((this.keys.has('KeyW') || this.keys.has('ArrowUp')) ? 1 : 0);
  return {
   x: (sx + sy) / Math.SQRT2,
   y: (sy - sx) / Math.SQRT2,
   run: this.running || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
  };
 }
}
