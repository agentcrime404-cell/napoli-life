import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/index.js';

test('Gruppo sociale: inviti tra amici, blocchi, uscita e successione del leader',async t=>{
 const app=createApp({dbPath:':memory:',edition:'3d'});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 async function register(username){const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'social-test-password'})});assert.equal(r.status,200);return r.json();}
 const a=await register('Social_A'),b=await register('Social_B'),c=await register('Social_C');
 async function api(path,account,body,method=body?'POST':'GET'){const r=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+account.token},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 await t.test('Server rifiuta inviti senza amicizia e limita la gestione al leader',async()=>{
  assert.equal((await api('social-group',a)).data.party,null);
  assert.equal((await api('social-group',a,{action:'invite',targetId:b.user.id})).status,400);
  assert.equal((await api('social-group',a,{action:'create'})).status,200);
  assert.equal((await api('social-group',a,{action:'invite',targetId:b.user.id})).status,403);
  assert.equal((await api('social-group',b,{action:'accept',inviteId:'missing'})).status,404);
 });
 await t.test('Invito, accettazione e una sola appartenenza per giocatore',async()=>{
  assert.equal((await api('friends',a,{id:b.user.id})).status,200);assert.equal((await api('friends',b,{id:a.user.id,action:'accept'})).status,200);
  assert.equal((await api('friends',a,{id:c.user.id})).status,200);assert.equal((await api('friends',c,{id:a.user.id,action:'accept'})).status,200);
  const invite=await api('social-group',a,{action:'invite',targetId:b.user.id});assert.equal(invite.status,200);
  let view=(await api('social-group',b)).data;assert.equal(view.invites.length,1);assert.equal(view.invites[0].sender.id,a.user.id);
  assert.equal((await api('social-group',b,{action:'create'})).status,200);
  assert.equal((await api('social-group',b,{action:'accept',inviteId:invite.data.inviteId})).status,400);
  await api('social-group',b,{action:'leave'});
  assert.equal((await api('social-group',b,{action:'accept',inviteId:invite.data.inviteId})).status,200);
  view=(await api('social-group',b)).data;assert.equal(view.party.members.length,2);assert.equal(view.party.leader_id,a.user.id);
  const options=(await api('social-group',a)).data.meetupOptions,ciro=options.find(s=>s.id==='mergellina:m31');assert.ok(ciro,'Chalet del Golfo deve essere una destinazione social autorizzata');assert.ok(options.some(s=>s.room==='lungomare'));
  assert.equal((await api('social-group',a,{action:'set-meetup',spotId:'mergellina:m31',x:99999,y:99999})).status,200);
  const shared=(await api('social-group',b)).data.party.meetup;assert.equal(shared.name,ciro.name);assert.equal(shared.room,'mergellina');assert.equal(shared.x,ciro.x);assert.notEqual(shared.x,99999);assert.equal(shared.responses[a.user.id],'yes');
  assert.deepEqual(shared.arrivals,{});assert.equal((await api('social-group',a,{action:'check-in-meetup'})).status,409,'il check-in richiede una sessione di gioco attiva');
  clearInterval(app.game.clock);app.game.clock=null;
  const online=(account,x,y,room='mergellina')=>({id:account.user.id,username:account.user.username,room,x,y,ws:{readyState:0},input:{x:0,y:0},lastInput:Date.now(),direction:0,travel:0});
  const aOnline=online(a,ciro.x+15,ciro.y),bOnline=online(b,ciro.x,ciro.y);app.game.players.set(a.user.id,aOnline);app.game.players.set(b.user.id,bOnline);
  assert.equal((await api('social-group',c,{action:'check-in-meetup'})).status,404,'un giocatore esterno al gruppo non può segnare l’arrivo');
  assert.equal((await api('social-group',a,{action:'check-in-meetup'})).status,400,'la posizione reale deve essere entro 12 metri');aOnline.x=ciro.x;aOnline.y=ciro.y;aOnline.room='lungomare';assert.equal((await api('social-group',a,{action:'check-in-meetup'})).status,400,'la stanza deve coincidere con quella del ritrovo');aOnline.room='mergellina';
  aOnline.x=ciro.x;aOnline.y=ciro.y;await api('social-group',b,{action:'respond-meetup',response:'maybe'});
  let checked=(await api('social-group',a,{action:'check-in-meetup'})).data.party.meetup;assert.ok(Number.isFinite(checked.arrivals[a.user.id]));assert.equal(checked.responses[a.user.id],'yes');
  const firstArrival=checked.arrivals[a.user.id];aOnline.x=ciro.x+30;checked=(await api('social-group',a,{action:'check-in-meetup'})).data.party.meetup;assert.equal(checked.arrivals[a.user.id],firstArrival,'il check-in ripetuto resta idempotente anche dopo essersi allontanati');aOnline.x=ciro.x;
  checked=(await api('social-group',b,{action:'check-in-meetup'})).data.party.meetup;assert.ok(Number.isFinite(checked.arrivals[b.user.id]));assert.equal(checked.responses[b.user.id],'yes','arrivare conferma la partecipazione');
  app.game.players.clear();
  assert.equal((await api('social-group',b,{action:'respond-meetup',response:'yes'})).data.party.meetup.responses[b.user.id],'yes');
  assert.equal((await api('social-group',b,{action:'respond-meetup',response:'maybe'})).data.party.meetup.responses[b.user.id],'maybe');
  assert.equal((await api('social-group',b,{action:'respond-meetup',response:'later'})).status,400);
  assert.equal((await api('social-group',c,{action:'respond-meetup',response:'yes'})).status,404,'chi è fuori da un gruppo non può rispondere a un ritrovo');
  await api('social-group',a,{action:'set-meetup',spotId:'lungomare:bar'});const moved=(await api('social-group',b)).data.party.meetup;assert.equal(moved.responses[a.user.id],'yes');assert.equal(moved.responses[b.user.id],undefined,'un nuovo luogo azzera le risposte del ritrovo precedente');
  await api('social-group',b,{action:'respond-meetup',response:'yes'});await api('social-group',a,{action:'kick',memberId:b.user.id});assert.equal((await api('social-group',a)).data.party.meetup.responses[b.user.id],undefined,'la risposta viene rimossa insieme al membro');assert.equal((await api('social-group',a)).data.party.meetup.arrivals[b.user.id],undefined,'l’arrivo viene rimosso insieme al membro');const rejoin=await api('social-group',a,{action:'invite',targetId:b.user.id});await api('social-group',b,{action:'accept',inviteId:rejoin.data.inviteId});
  assert.equal((await api('social-group',b,{action:'set-meetup',spotId:'lungomare:bar'})).status,403);
  assert.equal((await api('social-group',a,{action:'set-meetup',spotId:'mergellina:arbitrary'})).status,404);
  assert.equal((await api('social-group',a,{action:'clear-meetup'})).status,200);assert.equal((await api('social-group',b)).data.party.meetup,null);
  assert.equal((await api('social-group',b,{action:'invite',targetId:c.user.id})).status,403);
  assert.equal((await api('social-group',a,{action:'invite',targetId:b.user.id})).status,400);
  assert.equal((await api('social-group',a,{action:'invite',targetId:c.user.id})).status,200);
  view=(await api('social-group',c)).data;assert.equal(view.invites.length,1);
  await api('social-group',a,{action:'cancel',inviteId:view.invites[0].id});assert.equal((await api('social-group',c)).data.invites.length,0);
 });
 await t.test('Il blocco interrompe il gruppo e il leader uscente lascia il ruolo al membro più anziano',async()=>{
  const invite=await api('social-group',a,{action:'invite',targetId:c.user.id});assert.equal(invite.status,200);await api('social-group',c,{action:'accept',inviteId:invite.data.inviteId});
  assert.equal((await api('block',b,{id:c.user.id})).status,200);
  assert.equal((await api('social-group',c)).data.party,null);
  let group=(await api('social-group',a)).data.party;assert.deepEqual(group.members.map(m=>m.id),[a.user.id,b.user.id]);
  await api('social-group',a,{action:'leave'});group=(await api('social-group',b)).data.party;assert.equal(group.leader_id,b.user.id);assert.equal(group.members.length,1);
  await api('social-group',b,{action:'leave'});assert.equal((await api('social-group',b)).data.party,null);assert.equal((await api('social-group',a)).data.party,null);
 });
});
