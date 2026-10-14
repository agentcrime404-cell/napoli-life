import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {database} from '../server/database.js';
test('Database: migrazione ripetibile e dati conservati dopo il riavvio',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'humana-test-'));let db;
 try{db=database(join(dir,'test.sqlite'));db.prepare('INSERT INTO users(id,username,password) VALUES(?,?,?)').run('test','Persistence','hash-fixture');db.close();db=database(join(dir,'test.sqlite'));assert.equal(db.prepare('SELECT username FROM users WHERE id=?').get('test').username,'Persistence');assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);}
 finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
test('V2: posizione, economia, casa e preferenze persistono riaprendo SQLite',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'humana-v2-'));const path=join(dir,'test.sqlite');let db;
 try{
  db=database(path);db.prepare('INSERT INTO users(id,username,password) VALUES(?,?,?)').run('owner','Owner','hash-fixture');
  db.prepare('INSERT INTO player_state(user_id,position,settings,balance,progress) VALUES(?,?,?,?,?)').run('owner',JSON.stringify({room:'lungomare',x:22,y:22}),'{"voice":0.2}',65,'{"orders":2}');
  db.prepare('INSERT INTO inventory VALUES(?,?,?)').run('owner','bed',1);db.prepare('INSERT INTO homes VALUES(?,?,?)').run('owner','FRIENDS','[{"item":"bed","x":4,"y":4}]');db.close();db=database(path);
  const row=db.prepare('SELECT * FROM player_state WHERE user_id=?').get('owner');assert.equal(JSON.parse(row.position).x,22);assert.equal(row.balance,65);assert.equal(JSON.parse(row.settings).voice,.2);assert.equal(JSON.parse(row.progress).orders,2);assert.equal(db.prepare('SELECT quantity FROM inventory').get().quantity,1);assert.equal(db.prepare('SELECT privacy FROM homes').get().privacy,'FRIENDS');assert.equal(db.prepare('SELECT count(*) n FROM migrations').get().n,7);
 }finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
