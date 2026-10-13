// Zaino in stile server FiveM: gli oggetti comprati (tabella inventory) si usano, si danno a un giocatore vicino o si buttano.
// Bevande e cibo si consumano con l'animazione dei locali (Service.serve: alcol compreso), la tanica rifornisce il mezzo ovunque.
// Lo zaino ha un peso massimo (BAG.max kg): vale per gli acquisti e per i regali. Cosmetici e arredi non pesano (stanno nel guardaroba e in casa).
import {BAG,BAG_ITEMS,CATALOG,FUEL,VEHICLE} from '../shared/catalog.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const ITEM=new Map(BAG_ITEMS.map(i=>[i.id,i]));
const baseOf=id=>VEHICLE[id]?.base||id,isMotor=id=>!!id&&FUEL.motor.includes(baseOf(id));
const kg1=n=>Math.round(n*10)/10;
export class Bag{
 constructor(game){this.game=game;}
 get db(){return this.game.db;}
 tell(p,message){if(p?.ws)this.game.send(p.ws,{type:'notification',message});}
 qty(id,item){return this.db.prepare('SELECT quantity FROM inventory WHERE user_id=? AND item=?').get(id,item)?.quantity||0;}
 weight(id){let kg=0;for(const r of this.db.prepare('SELECT item,quantity FROM inventory WHERE user_id=?').all(id)){const it=ITEM.get(r.item);if(it)kg+=it.kg*r.quantity;}return kg1(kg);}
 fits(id,item,n=1){return this.weight(id)+item.kg*n<=BAG.max+1e-9;}
 take(id,item){const ch=this.db.prepare('UPDATE inventory SET quantity=quantity-1 WHERE user_id=? AND item=? AND quantity>0').run(id,item).changes;if(!ch)fail('Non ce l’hai nello zaino');this.db.prepare('DELETE FROM inventory WHERE user_id=? AND item=? AND quantity=0').run(id,item);}
 add(id,item){this.db.prepare('INSERT INTO inventory VALUES(?,?,1) ON CONFLICT(user_id,item) DO UPDATE SET quantity=quantity+1').run(id,item);}
 view(id){const rows=this.db.prepare('SELECT item,quantity FROM inventory WHERE user_id=?').all(id),own=new Map(rows.map(r=>[r.item,r.quantity]));
  const byType=t=>CATALOG.filter(i=>i.type===t&&own.get(i.id)>0).map(i=>({id:i.id,name:i.name,qty:own.get(i.id)}));
  return {max:BAG.max,slots:BAG.slots,kg:this.weight(id),items:BAG_ITEMS.filter(i=>own.get(i.id)>0).map(i=>({...i,qty:own.get(i.id)})),shop:BAG_ITEMS,cosmetics:byType('cosmetic'),furniture:byType('furniture')};}
 // Usa un oggetto: controlli prima, poi l'effetto, poi si toglie dallo zaino (la rosa resta: si regala).
 use(p,itemId){const it=ITEM.get(String(itemId||''));if(!it)fail('Oggetto sconosciuto');if(this.qty(p.id,it.id)<1)fail('Non ce l’hai nello zaino');if(p.jail)fail('Sei in prigione');
  if(it.use==='drink'||it.use==='food'){if(p.consuming)fail('Finisci prima quello che hai in mano');if(p.vehicle||p.seat)fail('Scendi prima dal mezzo');if(!this.game.service)fail('Non disponibile');
   this.take(p.id,it.id);this.game.service.serve(p,{id:it.id,icon:it.icon,kind:it.use,alc:it.alc||0});this.game.needs?.restore(p,it.use);if(!(it.alc>0))this.tell(p,(it.use==='food'?'😋 Mangi: ':'🥤 Bevi: ')+it.icon+' '+it.name);return this.view(p.id);}
  if(it.use==='fuel'){const fu=this.game.fuel;fu?.sync(p);const id=p.vehicle||p.fuelFor;if(!isMotor(id))fail('Non hai un mezzo a motore da rifornire');if(p.fueling)fail('Il benzinaio sta già lavorando');
   const level=p.vehicle?p.fuel:(p.tanks?.[id]??p.fuel??FUEL.tank);if(level>=95)fail('Il serbatoio è già pieno');this.take(p.id,it.id);
   const next=Math.min(FUEL.tank,level+BAG.fuel);p.tanks={...(p.tanks||{}),[id]:next};if(p.fuelFor===id||p.vehicle===id)p.fuel=next;p.emptyWarned=false;if(next>FUEL.low)p.lowFuel=false;
   this.tell(p,'⛽ Hai versato la tanica: serbatoio al '+Math.round(next)+'%');return this.view(p.id);}
  if(it.use==='gift'){this.tell(p,it.icon+' '+it.name+': regalala a qualcuno con «Dai»!');return this.view(p.id);}
  fail('Questo oggetto non si usa');}
 // Dai un oggetto a un giocatore vicino (stessa stanza, entro BAG.reach metri) se nel suo zaino c'è posto.
 give(p,itemId,toId){const it=ITEM.get(String(itemId||''));if(!it)fail('Oggetto sconosciuto');if(p.jail)fail('Sei in prigione');
  const t=[...this.game.players.values()].find(q=>String(q.id)===String(toId));if(!t||t.id===p.id)fail('Giocatore non trovato');
  if(t.room!==p.room||Math.hypot(t.x-p.x,t.y-p.y)>BAG.reach)fail('Avvicinati di più (meno di '+BAG.reach+' m)');if(!this.fits(t.id,it))fail('Lo zaino di '+t.username+' è pieno');
  this.db.exec('BEGIN IMMEDIATE');try{this.take(p.id,it.id);this.add(t.id,it.id);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}
  this.tell(p,'🎁 Hai dato '+it.icon+' '+it.name+' a '+t.username);this.tell(t,'🎁 '+p.username+' ti ha dato '+it.icon+' '+it.name+(it.use==='gift'?' ❤️':''));this.game.send(t.ws,{type:'bag'});return this.view(p.id);}
 drop(p,itemId){const it=ITEM.get(String(itemId||''));if(!it)fail('Oggetto sconosciuto');this.take(p.id,it.id);this.tell(p,'🗑️ Hai buttato '+it.icon+' '+it.name);return this.view(p.id);}
 route(path,method,p,b){if(!p)fail('Entra prima nel gioco');
  if(path==='/api/bag'&&method==='GET')return this.view(p.id);
  if(method!=='POST')return undefined;
  if(path==='/api/bag/use')return this.use(p,b.item);
  if(path==='/api/bag/give')return this.give(p,b.item,b.to);
  if(path==='/api/bag/drop')return this.drop(p,b.item);
  return undefined;}
}
