import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function database(path){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
 db.exec(`CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL COLLATE NOCASE UNIQUE,password TEXT NOT NULL,bio TEXT NOT NULL DEFAULT '',avatar TEXT NOT NULL DEFAULT '{"color":"#41d9cf","accessory":"none"}');
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS friendships(sender TEXT REFERENCES users(id) ON DELETE CASCADE,receiver TEXT REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'pending',PRIMARY KEY(sender,receiver));
 CREATE TABLE IF NOT EXISTS blocks(owner TEXT REFERENCES users(id) ON DELETE CASCADE,target TEXT REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(owner,target));
 CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,owner TEXT REFERENCES users(id) ON DELETE SET NULL,target TEXT,reason TEXT,created INTEGER);
 CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,sender TEXT REFERENCES users(id) ON DELETE CASCADE,room TEXT,text TEXT,created INTEGER);
 INSERT OR IGNORE INTO migrations VALUES(1);`);
 if(!db.prepare('SELECT 1 FROM migrations WHERE version=2').get()){
 db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE player_state(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,position TEXT NOT NULL DEFAULT '{}',settings TEXT NOT NULL DEFAULT '{}',progress TEXT NOT NULL DEFAULT '{}',balance INTEGER NOT NULL DEFAULT 100 CHECK(balance>=0),walked REAL NOT NULL DEFAULT 0,reward_day TEXT NOT NULL DEFAULT '',last_active INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE inventory(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,item TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>=0),PRIMARY KEY(user_id,item));
 CREATE TABLE purchases(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,request_id TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(user_id,request_id));
 CREATE TABLE homes(owner TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,privacy TEXT NOT NULL DEFAULT 'PRIVATE',furniture TEXT NOT NULL DEFAULT '[]');
 CREATE TABLE home_invites(owner TEXT REFERENCES users(id) ON DELETE CASCADE,guest TEXT REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL,PRIMARY KEY(owner,guest));
 CREATE TABLE direct_messages(id INTEGER PRIMARY KEY,sender TEXT REFERENCES users(id) ON DELETE CASCADE,recipient TEXT REFERENCES users(id) ON DELETE CASCADE,text TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE events(id INTEGER PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,location TEXT NOT NULL,start_time INTEGER NOT NULL,end_time INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'scheduled',owner TEXT REFERENCES users(id) ON DELETE CASCADE);
 CREATE TABLE event_members(event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(event_id,user_id));
 CREATE INDEX dm_recipient ON direct_messages(recipient,created);
 INSERT INTO migrations VALUES(2);COMMIT;`);
 }
 if(!db.prepare('SELECT 1 FROM migrations WHERE version=3').get())db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE villas(id TEXT PRIMARY KEY,owner TEXT REFERENCES users(id) ON DELETE CASCADE,mode TEXT NOT NULL,until INTEGER NOT NULL);
 INSERT INTO migrations VALUES(3);COMMIT;`);
 if(!db.prepare('SELECT 1 FROM migrations WHERE version=4').get())db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE IF NOT EXISTS google_accounts(sub TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,email TEXT NOT NULL DEFAULT '');
 INSERT INTO migrations VALUES(4);COMMIT;`);
 if(!db.prepare('SELECT 1 FROM migrations WHERE version=5').get())db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE IF NOT EXISTS map_edits(id INTEGER PRIMARY KEY CHECK(id=1),doc TEXT NOT NULL,updated INTEGER NOT NULL);
 INSERT INTO migrations VALUES(5);COMMIT;`);
 if(!db.prepare('SELECT 1 FROM migrations WHERE version=6').get())db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE social_groups(id TEXT PRIMARY KEY,leader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created INTEGER NOT NULL);
 CREATE TABLE social_group_members(group_id TEXT NOT NULL REFERENCES social_groups(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,joined INTEGER NOT NULL,PRIMARY KEY(group_id,user_id),UNIQUE(user_id));
 CREATE TABLE social_group_invites(id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES social_groups(id) ON DELETE CASCADE,sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created INTEGER NOT NULL,expires INTEGER NOT NULL,UNIQUE(group_id,target_id));
 CREATE INDEX social_group_invites_target ON social_group_invites(target_id,expires);
 INSERT INTO migrations VALUES(6);COMMIT;`);
 if(!db.prepare('SELECT 1 FROM migrations WHERE version=7').get())db.exec(`BEGIN IMMEDIATE;
 ALTER TABLE social_groups ADD COLUMN meetup TEXT;
 INSERT INTO migrations VALUES(7);COMMIT;`);
 return db;
}
