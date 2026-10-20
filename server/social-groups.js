import {randomUUID} from 'node:crypto';
import {doors} from '../shared/world.js';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const MAX_MEMBERS=6,INVITE_TTL=30*60*1000;
const SOCIAL_KINDS=new Set(['bar','cafe','ice_cream','pastry','restaurant','fast_food','pub']);
const LUNGOMARE_SPOTS=new Set(['bar','pizzeria','club','burger','osteria','vesuvio','trattoria','panorama']);
const MEETUP_CENTER={x:225,y:387};

// Piccoli gruppi temporanei di amici per organizzare giri, incontri e attività civili.
// Restano separati da gang/fazioni e non cambiano posizioni o permessi nel mondo.
export class SocialGroups{
 constructor(db,game){this.db=db;this.game=game;}
 meetupOptions(){
  const mergellina=doors('mergellina').filter(d=>SOCIAL_KINDS.has(d.kind))
   .map(d=>({...d,room:'mergellina',category:d.kind==='bar'||d.kind==='cafe'||d.kind==='ice_cream'||d.kind==='pastry'?'Caffè e bar':'Ristorazione',distance:Math.hypot(d.x-MEETUP_CENTER.x,d.y-MEETUP_CENTER.y)}))
   .filter(d=>d.distance<=190).sort((a,b)=>a.distance-b.distance).slice(0,8);
  const lungomare=doors('lungomare').filter(d=>LUNGOMARE_SPOTS.has(d.id))
   .map(d=>({...d,room:'lungomare',category:d.id==='club'?'Musica e socialità':'Caffè e ristorazione'}));
  return [...mergellina,...lungomare].map(d=>({id:d.room==='mergellina'&&d.osm==='node/2508856019'?'mergellina:m31':d.room+':'+d.id,name:d.name,room:d.room,x:d.exitX??d.x,y:d.exitY??d.y,category:d.category}));
 }
 groupIdFor(userId){return this.db.prepare('SELECT group_id FROM social_group_members WHERE user_id=?').get(userId)?.group_id||null;}
 isFriend(a,b){return !!this.db.prepare("SELECT 1 FROM friendships WHERE status='accepted' AND ((sender=? AND receiver=?) OR (sender=? AND receiver=?))").get(a,b,b,a);}
 members(groupId){const group=this.db.prepare('SELECT id,leader_id,created,meetup FROM social_groups WHERE id=?').get(groupId);if(!group)return null;const members=this.db.prepare('SELECT u.id,u.username,m.joined FROM social_group_members m JOIN users u ON u.id=m.user_id WHERE m.group_id=? ORDER BY m.joined,u.username').all(groupId).map(m=>({id:m.id,username:m.username,online:this.game.players.has(m.id),leader:m.id===group.leader_id,joined:m.joined}));let meetup=null;try{meetup=group.meetup?JSON.parse(group.meetup):null;}catch{}return {...group,meetup,members};}
 view(userId){this.db.prepare('DELETE FROM social_group_invites WHERE expires<=?').run(Date.now());const id=this.groupIdFor(userId),party=id?this.members(id):null,now=Date.now();const invites=this.db.prepare('SELECT i.id,i.group_id,i.expires,u.id AS sender_id,u.username FROM social_group_invites i JOIN users u ON u.id=i.sender_id WHERE i.target_id=? AND i.expires>? ORDER BY i.created DESC LIMIT 12').all(userId,now).map(i=>({id:i.id,groupId:i.group_id,expires:i.expires,sender:{id:i.sender_id,username:i.username,online:this.game.players.has(i.sender_id)}}));const sentInvites=this.db.prepare('SELECT i.id,i.expires,u.id AS target_id,u.username FROM social_group_invites i JOIN users u ON u.id=i.target_id WHERE i.sender_id=? AND i.expires>? ORDER BY i.created DESC LIMIT 12').all(userId,now).map(i=>({id:i.id,expires:i.expires,target:{id:i.target_id,username:i.username,online:this.game.players.has(i.target_id)}}));return {party,invites,sentInvites,meetupOptions:this.meetupOptions(),maxMembers:MAX_MEMBERS};}
 route(path,method,user,b={}){if(path!=='/api/social-group')return undefined;if(method==='GET')return this.view(user.id);if(method!=='POST')return undefined;const action=String(b.action||''),id=user.id;
  if(action==='create'){
   if(this.groupIdFor(id))fail('Sei già in un gruppo sociale');
   const groupId=randomUUID(),now=Date.now();this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT INTO social_groups(id,leader_id,created) VALUES(?,?,?)').run(groupId,id,now);this.db.prepare('INSERT INTO social_group_members(group_id,user_id,joined) VALUES(?,?,?)').run(groupId,id,now);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');if(/UNIQUE/.test(e.message))fail('Sei già in un gruppo sociale');throw e;}
   return this.view(id);
  }
  if(action==='invite'){
   const groupId=this.groupIdFor(id);if(!groupId)fail('Crea o raggiungi un gruppo prima di invitare');const group=this.db.prepare('SELECT * FROM social_groups WHERE id=?').get(groupId);if(group.leader_id!==id)fail('Solo chi ha creato il gruppo può invitare',403);
   const targetId=String(b.targetId||'');const target=this.db.prepare('SELECT id,username FROM users WHERE id=?').get(targetId);if(!target||targetId===id||this.game.blocked(id,targetId)||!this.isFriend(id,targetId))fail('Puoi invitare solo un amico non bloccato',403);
   if(this.groupIdFor(targetId))fail('Questo amico è già in un gruppo');if(this.db.prepare('SELECT COUNT(*) n FROM social_group_members WHERE group_id=?').get(groupId).n>=MAX_MEMBERS)fail('Il gruppo è al completo');
   const now=Date.now(),existing=this.db.prepare('SELECT id FROM social_group_invites WHERE group_id=? AND target_id=? AND expires>?').get(groupId,targetId,now),inviteId=existing?.id||randomUUID();
   this.db.prepare('INSERT INTO social_group_invites(id,group_id,sender_id,target_id,created,expires) VALUES(?,?,?,?,?,?) ON CONFLICT(group_id,target_id) DO UPDATE SET sender_id=excluded.sender_id,created=excluded.created,expires=excluded.expires').run(inviteId,groupId,id,targetId,now,now+INVITE_TTL);
   this.notify(targetId,{message:user.username+' ti invita nel suo gruppo sociale',socialGroup:{action:'invite',groupId,inviteId}});return {ok:true,inviteId,expires:now+INVITE_TTL};
  }
  if(action==='accept'){
   const inviteId=String(b.inviteId||''),now=Date.now();this.db.exec('BEGIN IMMEDIATE');let groupId;
   try{const invite=this.db.prepare('SELECT * FROM social_group_invites WHERE id=? AND target_id=? AND expires>?').get(inviteId,id,now);if(!invite)fail('Invito scaduto o non disponibile',404);groupId=invite.group_id;if(this.groupIdFor(id))fail('Sei già in un gruppo sociale');if(this.game.blocked(invite.sender_id,id)||!this.isFriend(invite.sender_id,id))fail('L’invito non è più valido',403);const count=this.db.prepare('SELECT COUNT(*) n FROM social_group_members WHERE group_id=?').get(groupId).n;if(count>=MAX_MEMBERS)fail('Il gruppo è al completo');this.db.prepare('INSERT INTO social_group_members(group_id,user_id,joined) VALUES(?,?,?)').run(groupId,id,now);this.db.prepare('DELETE FROM social_group_invites WHERE target_id=?').run(id);this.db.exec('COMMIT');}
   catch(e){this.db.exec('ROLLBACK');throw e;}
   for(const m of this.db.prepare('SELECT user_id FROM social_group_members WHERE group_id=? AND user_id<>?').all(groupId,id))this.notify(m.user_id,{message:user.username+' si è unito al gruppo',socialGroup:{action:'member-joined',groupId}});return this.view(id);
  }
  if(action==='decline'||action==='cancel'){
   const inviteId=String(b.inviteId||''),invite=this.db.prepare('SELECT * FROM social_group_invites WHERE id=?').get(inviteId);if(!invite)fail('Invito non disponibile',404);if(action==='decline'&&invite.target_id!==id||action==='cancel'&&invite.sender_id!==id)fail('Invito non tuo',403);this.db.prepare('DELETE FROM social_group_invites WHERE id=?').run(inviteId);return {ok:true};
  }
  if(action==='leave'){
   const groupId=this.groupIdFor(id);if(!groupId)fail('Non fai parte di un gruppo');this.removeMember(groupId,id);return this.view(id);
  }
  if(action==='kick'){
   const groupId=this.groupIdFor(id),group=groupId&&this.db.prepare('SELECT * FROM social_groups WHERE id=?').get(groupId),targetId=String(b.memberId||'');if(!group||group.leader_id!==id)fail('Solo il leader può gestire il gruppo',403);if(!targetId||targetId===id||!this.db.prepare('SELECT 1 FROM social_group_members WHERE group_id=? AND user_id=?').get(groupId,targetId))fail('Membro non valido');this.removeMember(groupId,targetId);this.notify(targetId,{message:'Non fai più parte del gruppo sociale',socialGroup:{action:'removed',groupId}});return this.view(id);
  }
  if(action==='set-meetup'){
   const groupId=this.groupIdFor(id),group=groupId&&this.db.prepare('SELECT * FROM social_groups WHERE id=?').get(groupId);if(!group)fail('Crea o raggiungi un gruppo prima di proporre un ritrovo');if(group.leader_id!==id)fail('Solo il leader può proporre il ritrovo',403);
   const spot=this.meetupOptions().find(s=>s.id===String(b.spotId||''));if(!spot)fail('Questo luogo non è disponibile per il ritrovo',404);
   const meetup={...spot,id:randomUUID(),created:Date.now(),createdBy:id,responses:{[id]:'yes'},arrivals:{}};this.db.prepare('UPDATE social_groups SET meetup=? WHERE id=?').run(JSON.stringify(meetup),groupId);
   for(const m of this.db.prepare('SELECT user_id FROM social_group_members WHERE group_id=?').all(groupId))this.notify(m.user_id,{message:'Nuovo ritrovo del gruppo: '+spot.name,socialGroup:{action:'meetup-set',groupId,meetup}});
   return this.view(id);
  }
  if(action==='respond-meetup'){
   const groupId=this.groupIdFor(id),group=groupId&&this.db.prepare('SELECT meetup FROM social_groups WHERE id=?').get(groupId);if(!group||!group.meetup)fail('Il gruppo non ha un ritrovo attivo',404);
   if(!this.db.prepare('SELECT 1 FROM social_group_members WHERE group_id=? AND user_id=?').get(groupId,id))fail('Devi far parte del gruppo per rispondere',403);
   const response=String(b.response||'');if(!['yes','maybe','no'].includes(response))fail('Risposta al ritrovo non valida');
   let meetup;try{meetup=JSON.parse(group.meetup);}catch{fail('Il ritrovo non è disponibile',404);}
   const responses=meetup.responses&&typeof meetup.responses==='object'&&!Array.isArray(meetup.responses)?meetup.responses:{};if(responses[id]===response)return this.view(id);responses[id]=response;meetup.responses=responses;
   this.db.prepare('UPDATE social_groups SET meetup=? WHERE id=?').run(JSON.stringify(meetup),groupId);
   const labels={yes:'partecipa',maybe:'forse partecipa',no:'non partecipa'};for(const m of this.db.prepare('SELECT user_id FROM social_group_members WHERE group_id=? AND user_id<>?').all(groupId,id))this.notify(m.user_id,{message:user.username+' '+labels[response]+' al ritrovo del gruppo',socialGroup:{action:'meetup-response',groupId,response}});
   return this.view(id);
  }
  if(action==='check-in-meetup'){
   const groupId=this.groupIdFor(id),group=groupId&&this.db.prepare('SELECT meetup FROM social_groups WHERE id=?').get(groupId);if(!group||!group.meetup)fail('Il gruppo non ha un ritrovo attivo',404);
   if(!this.db.prepare('SELECT 1 FROM social_group_members WHERE group_id=? AND user_id=?').get(groupId,id))fail('Devi far parte del gruppo per segnare l’arrivo',403);
   let meetup;try{meetup=JSON.parse(group.meetup);}catch{fail('Il ritrovo non è disponibile',404);}
   const arrivals=meetup.arrivals&&typeof meetup.arrivals==='object'&&!Array.isArray(meetup.arrivals)?meetup.arrivals:{};
   if(Object.hasOwn(arrivals,id))return this.view(id);
   const player=this.game.players.get(id);if(!player)fail('Entra in città per segnare l’arrivo',409);
   if(player.room!==meetup.room||!Number.isFinite(player.x)||!Number.isFinite(player.y)||Math.hypot(player.x-meetup.x,player.y-meetup.y)>12)fail('Avvicinati al luogo del ritrovo per segnare l’arrivo');
   arrivals[id]=Date.now();meetup.arrivals=arrivals;
   const responses=meetup.responses&&typeof meetup.responses==='object'&&!Array.isArray(meetup.responses)?meetup.responses:{};responses[id]='yes';meetup.responses=responses;
   this.db.prepare('UPDATE social_groups SET meetup=? WHERE id=?').run(JSON.stringify(meetup),groupId);
   for(const m of this.db.prepare('SELECT user_id FROM social_group_members WHERE group_id=? AND user_id<>?').all(groupId,id))this.notify(m.user_id,{message:user.username+' è arrivato a '+meetup.name,socialGroup:{action:'meetup-arrived',groupId,memberId:id}});
   return this.view(id);
  }
  if(action==='clear-meetup'){
   const groupId=this.groupIdFor(id),group=groupId&&this.db.prepare('SELECT * FROM social_groups WHERE id=?').get(groupId);if(!group)fail('Non fai parte di un gruppo');if(group.leader_id!==id)fail('Solo il leader può annullare il ritrovo',403);if(!group.meetup)fail('Il gruppo non ha un ritrovo attivo');
   this.db.prepare('UPDATE social_groups SET meetup=NULL WHERE id=?').run(groupId);for(const m of this.db.prepare('SELECT user_id FROM social_group_members WHERE group_id=?').all(groupId))this.notify(m.user_id,{message:'Il ritrovo del gruppo è stato annullato',socialGroup:{action:'meetup-cleared',groupId}});return this.view(id);
  }
  fail('Azione gruppo non valida');
 }
 removeMember(groupId,userId){const group=this.db.prepare('SELECT leader_id,meetup FROM social_groups WHERE id=?').get(groupId);if(!group)return;if(group.meetup){try{const meetup=JSON.parse(group.meetup);let changed=false;for(const key of ['responses','arrivals'])if(meetup[key]&&typeof meetup[key]==='object'&&Object.hasOwn(meetup[key],userId)){delete meetup[key][userId];changed=true;}if(changed)this.db.prepare('UPDATE social_groups SET meetup=? WHERE id=?').run(JSON.stringify(meetup),groupId);}catch{}}this.db.prepare('DELETE FROM social_group_members WHERE group_id=? AND user_id=?').run(groupId,userId);this.db.prepare('DELETE FROM social_group_invites WHERE group_id=? AND (target_id=? OR sender_id=?)').run(groupId,userId,userId);const next=this.db.prepare('SELECT user_id FROM social_group_members WHERE group_id=? ORDER BY joined,user_id LIMIT 1').get(groupId);if(!next){this.db.prepare('DELETE FROM social_groups WHERE id=?').run(groupId);return;}if(group.leader_id===userId)this.db.prepare('UPDATE social_groups SET leader_id=? WHERE id=?').run(next.user_id,groupId);for(const m of this.db.prepare('SELECT user_id FROM social_group_members WHERE group_id=?').all(groupId))this.notify(m.user_id,{message:'Il gruppo sociale è stato aggiornato',socialGroup:{action:'updated',groupId}});}
 onBlock(blockerId,targetId){this.db.prepare('DELETE FROM social_group_invites WHERE (sender_id=? AND target_id=?) OR (sender_id=? AND target_id=?)').run(blockerId,targetId,targetId,blockerId);const a=this.groupIdFor(blockerId),b=this.groupIdFor(targetId);if(a&&a===b){const leader=this.db.prepare('SELECT leader_id FROM social_groups WHERE id=?').get(a)?.leader_id;this.removeMember(a,leader===targetId?blockerId:targetId);}}
 notify(id,data){const p=this.game.players.get(id);if(p)this.game.send(p.ws,{type:'notification',...data});}
}
