import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../server/database.js';
import {ensureState} from '../server/storage.js';
import {Living} from '../server/living.js';
import {Biz} from '../server/biz.js';
import {BIZ} from '../shared/catalog.js';
import {NAPOLI,setNapoli} from '../shared/napoli.js';
import {registerMergellina,doors} from '../shared/world.js';
import fs from 'node:fs';

if(!NAPOLI.data){setNapoli(JSON.parse(fs.readFileSync('client/assets/world/napoli/map/mergellina.json')));registerMergellina();}
const setup=()=>{const db=database(':memory:'),log=[];for(const [id,name] of [['o','Proprietaria'],['c','Cliente']]){db.prepare('INSERT INTO users(id,username,password) VALUES(?,?,?)').run(id,name,'x');ensureState(db,id);db.prepare('UPDATE player_state SET balance=10000 WHERE user_id=?').run(id);}
 const game={db,log,send:(ws,m)=>log.push({to:ws.id,...m}),players:new Map(),arena:null};game.biz=new Biz(game);const living=new Living(db,game);living.edition='3d';
 const shop=doors('mergellina').find(d=>d.to==='shop');const inShop=(id,name)=>{const p={id,username:name,room:'shop',x:5,y:5,from:{room:'mergellina',x:shop.exitX??shop.x,y:shop.exitY??shop.y},input:{x:0,y:0},ws:{id},myCars:[]};game.players.set(id,p);return p;};
 const bal=id=>db.prepare('SELECT balance FROM player_state WHERE user_id=?').get(id).balance;let n=0;const buy=(id,item,steal)=>{living.theft=steal?{id,amount:0}:null;try{return living.purchase(id,{item,requestId:'prova-biz-'+(++n)});}finally{living.theft=null;}};
 return {game,living,shop,inShop,bal,buy};};

test('Locali: si compra quello in cui si è entrati, un solo proprietario, la cassa cresce con le spese dei clienti',()=>{
 const {game,shop,inShop,bal,buy}=setup(),B=game.biz;const o=inShop('o','Proprietaria'),c=inShop('c','Cliente');
 assert.equal(B.view(o).here.name,shop.name);
 B.route('/api/biz/buy','POST',o,{});assert.equal(bal('o'),10000-BIZ.price.shop);assert.equal(B.view(o).mine.length,1);
 assert.throws(()=>B.route('/api/biz/buy','POST',c,{}),/già un proprietario/);
 buy('c','zaino-tanica');assert.equal(B.row(shop.id).cassa,Math.round(25*BIZ.cut),'20% della spesa nella cassa');
 buy('c','zaino-tanica',true);assert.equal(B.row(shop.id).cassa,Math.round(50*BIZ.cut),'il vecchio flag furto non rende gratuito l’acquisto né blocca l’incasso');
 buy('o','zaino-birra');assert.equal(B.row(shop.id).cassa,Math.round(50*BIZ.cut),'la proprietaria non aumenta la cassa comprando dal proprio locale');
 const before=bal('o');B.route('/api/biz/collect','POST',o,{door:shop.id});assert.equal(bal('o'),before+10);assert.equal(B.row(shop.id).cassa,0);
 assert.throws(()=>B.route('/api/biz/collect','POST',c,{door:shop.id}),/Non è un tuo locale/);
 const b2=bal('o');B.route('/api/biz/sell','POST',o,{door:shop.id});assert.equal(bal('o'),b2+Math.round(BIZ.price.shop*BIZ.sell));assert.equal(B.row(shop.id),undefined);
});

test('Locali: incasso passivo ogni tanto per chi è in gioco; la banca non si compra',()=>{
 const {game,inShop}=setup(),B=game.biz;const o=inShop('o','Proprietaria');B.route('/api/biz/buy','POST',o,{});
 B.tick(o);o.bizAt=Date.now()-1;B.tick(o);assert.equal(B.mine('o')[0].cassa,BIZ.passive);
 const p={...o,room:'bank'};assert.throws(()=>B.route('/api/biz/buy','POST',p,{}),/Entra in un locale/);
});
