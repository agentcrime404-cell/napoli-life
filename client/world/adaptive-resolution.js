// Require sustained headroom before increasing resolution; one slow sample lowers it.
export class AdaptiveResolution {
 constructor({target=30,min=.6,step=.1}={}){this.target=target;this.min=min;this.step=step;this.stable=0;this.cooldown=0;this.belowTarget=0;}
 sample(fps,scale,renderP95Ms=null){
  if(!Number.isFinite(fps)||fps<=0){this.stable=0;this.belowTarget=0;return scale;}
  if(this.cooldown>0)this.cooldown--;
  const renderBudget=1000/this.target*.68,measuredRender=Number.isFinite(renderP95Ms);
  // Reserve at least 32% of the target frame for input, physics, networking,
  // and scheduling variation. A renderer that uses most of the remaining
  // budget steps down one resolution notch before gameplay becomes uneven, so
  // visibly collapses. A single near-target sample is treated as host jitter;
  // repeated samples below 30 FPS trigger a smaller, measured quality step.
  if(fps<this.target*.87||measuredRender&&renderP95Ms>renderBudget*.95){this.stable=0;this.belowTarget=0;this.cooldown=4;return Math.max(this.min,scale-this.step);}
  this.belowTarget=fps<this.target*.97?this.belowTarget+1:0;
  if(this.belowTarget>=2&&!this.cooldown){this.belowTarget=0;this.stable=0;this.cooldown=4;return Math.max(this.min,scale-this.step);}
  const hasHeadroom=fps>=this.target*.97&&(!measuredRender||renderP95Ms<renderBudget*.85);
  if(hasHeadroom&&!this.cooldown){
   if(++this.stable>=3){this.stable=0;this.cooldown=3;return Math.min(1,scale+this.step/2);}
  }else this.stable=0;
  return scale;
 }
}
