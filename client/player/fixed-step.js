// Accumula il tempo del frame e avanza la simulazione con intervalli costanti.
export class FixedStepper {
 constructor(stepSeconds = 1 / 60, maxFrameSeconds = .1, maxSteps = 6) {
  this.stepSeconds = stepSeconds;
  this.maxFrameSeconds = maxFrameSeconds;
  this.maxSteps = maxSteps;
  this.accumulator = 0;
 }

 advance(frameSeconds, update) {
  const delta = Number.isFinite(frameSeconds) ? Math.max(0, Math.min(this.maxFrameSeconds, frameSeconds)) : 0;
  this.accumulator = Math.min(this.accumulator + delta, this.stepSeconds * this.maxSteps);
  let steps = 0;
  while (this.accumulator + 1e-9 >= this.stepSeconds && steps < this.maxSteps) {
   update(this.stepSeconds);
   this.accumulator -= this.stepSeconds;
   steps++;
  }
  return steps;
 }

 reset() { this.accumulator = 0; }
}
