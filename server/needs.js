import {state} from './storage.js';

const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};

// Needs are deliberately small and server-authoritative: the browser only renders
// the values and the food/drink effects are applied after inventory validation.
export class Needs {
 constructor(game){this.game=game;this.lastSave=new Map();}
 // p.needsExact tiene i decimali: arrotondando a ogni tick il calo (pochi millesimi) si annullava e fame e sete restavano sempre a 100.
 load(p){if(p.needsLoaded)return;p.needsLoaded=true;const pr=state(this.game.db,p.id).progress,n=pr.needs||{};p.needs={hunger:clamp(n.hunger??100),thirst:clamp(n.thirst??100)};p.needsExact={...p.needs};p.needsSave=Date.now();}
 exact(p){if(!p.needsExact||Math.round(p.needsExact.hunger)!==p.needs.hunger||Math.round(p.needsExact.thirst)!==p.needs.thirst)p.needsExact={...p.needs};return p.needsExact;}
 save(p){this.load(p);const pr=state(this.game.db,p.id).progress;pr.needs={...p.needs};this.game.db.prepare('UPDATE player_state SET progress=? WHERE user_id=?').run(JSON.stringify(pr),p.id);p.needsSave=Date.now();}
 tick(p,dt){this.load(p);if(!Number.isFinite(dt)||dt<=0)return;const before=p.needs.hunger+ p.needs.thirst;const e=this.exact(p);e.hunger=Math.max(0,Math.min(100,e.hunger-dt*.018));e.thirst=Math.max(0,Math.min(100,e.thirst-dt*.026));p.needs.hunger=clamp(e.hunger);p.needs.thirst=clamp(e.thirst);const after=p.needs.hunger+p.needs.thirst;if(Date.now()-p.needsSave>30000&&before!==after)this.save(p);if(after<55&&Math.floor(Date.now()/60000)!==p.needsNotice){p.needsNotice=Math.floor(Date.now()/60000);this.game.send(p.ws,{type:'notification',message:after<25?'🥵 Hai bisogno di mangiare e bere.':'🍽️ La fame o la sete stanno scendendo.'});}}
 view(p){this.load(p);return {...p.needs};}
 restore(p,kind){this.load(p);if(kind==='food')p.needs.hunger=clamp(p.needs.hunger+35);else if(kind==='drink')p.needs.thirst=clamp(p.needs.thirst+35);else fail('Bisogno sconosciuto');p.needsExact={...p.needs};this.save(p);this.game.send(p.ws,{type:'needs',needs:p.needs});return this.view(p);}
 route(path,method,p){if(path!=='/api/needs')return undefined;if(!p)fail('Entra prima nel gioco');if(method==='GET')return this.view(p);return undefined;}
}
