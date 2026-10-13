// Require sustained headroom before increasing resolution; one slow sample lowers it.
export class AdaptiveResolution {
 constructor({target=30,min=.6,step=.1}={}){this.target=target;this.min=min;this.step=step;this.stable=0;this.cooldown=0;}
 sample(fps,scale){
  if(!Number.isFinite(fps)||fps<=0){this.stable=0;return scale;}
  if(this.cooldown>0)this.cooldown--;
  if(fps<this.target*.87){this.stable=0;this.cooldown=4;return Math.max(this.min,scale-this.step);}
  if(fps>=this.target*.97&&!this.cooldown){
   if(++this.stable>=3){this.stable=0;this.cooldown=3;return Math.min(1,scale+this.step/2);}
  }else this.stable=0;
  return scale;
 }
}
