import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const root=process.cwd();

test('import OSM conserva gli ID e non disegna corridoi interni come strade',()=>{
 const dir=mkdtempSync(join(tmpdir(),'napoli-osm-import-'));
 try{
  const source=join(dir,'fixture.osm'),output=join(dir,'fixture.json');
  writeFileSync(source,`<?xml version="1.0"?><osm version="0.6" generator="fixture"><bounds minlat="40.8301" minlon="14.2173" maxlat="40.8304" maxlon="14.2177"/>
   <node id="1" lat="40.83020" lon="14.21740"/><node id="2" lat="40.83020" lon="14.21744"/><node id="3" lat="40.83024" lon="14.21744"/><node id="4" lat="40.83024" lon="14.21740"/>
   <node id="10" lat="40.83025" lon="14.21732"/><node id="11" lat="40.83025" lon="14.21755"/>
   <node id="20" lat="40.83021" lon="14.21732"/><node id="21" lat="40.83021" lon="14.21755"/>
   <node id="30" lat="40.83026" lon="14.21732"/><node id="31" lat="40.83026" lon="14.21755"/>
   <node id="51" lat="40.83022" lon="14.21738"/><node id="52" lat="40.83022" lon="14.21742"/><node id="53" lat="40.83026" lon="14.21742"/><node id="54" lat="40.83026" lon="14.21738"/>
   <node id="61" lat="40.83021" lon="14.21735"/><node id="62" lat="40.83021" lon="14.21739"/><node id="63" lat="40.83025" lon="14.21739"/><node id="64" lat="40.83025" lon="14.21735"/>
   <way id="100"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building" v="yes"/></way>
   <way id="200"><nd ref="10"/><nd ref="11"/><tag k="highway" v="residential"/></way>
   <way id="300"><nd ref="20"/><nd ref="21"/><tag k="highway" v="corridor"/><tag k="indoor" v="yes"/></way>
   <way id="400"><nd ref="30"/><nd ref="31"/><tag k="highway" v="footway"/></way>
   <way id="500"><nd ref="51"/><nd ref="52"/><nd ref="53"/><nd ref="54"/><nd ref="51"/><tag k="highway" v="pedestrian"/><tag k="area" v="yes"/><tag k="name" v="Piazzetta Leone a Mergellina"/></way>
   <way id="600"><nd ref="61"/><nd ref="62"/><nd ref="63"/><nd ref="64"/><nd ref="61"/><tag k="place" v="square"/><tag k="name" v="Piazza Jacopo Sannazaro"/></way>
  </osm>`,{encoding:'utf8'});
  writeFileSync(join(dir,'fixture.bbox.json'),JSON.stringify({fonte:'OSM fixture',scaricato:'2026-10-17',licenza:'ODbL'}));
  execFileSync(process.execPath,[resolve(root,'scripts/osm-napoli.mjs'),source,output],{cwd:root,stdio:'pipe'});
  const map=JSON.parse(readFileSync(output,'utf8'));
  assert.equal(map.source,'OSM fixture');
  assert.equal(map.buildings[0].osm,'way/100');
  assert.ok(map.roads.some(road=>road.osm==='way/200'&&road.k==='residential'));
  assert.ok(map.roads.some(road=>road.osm==='way/400'&&road.k==='footway'));
  assert.ok(!map.roads.some(road=>road.osm==='way/300'),'i corridoi interni non sono geometria stradale esterna');
  assert.equal(map.landmarks.find(item=>item.name==='Piazzetta del Leone (Mergellina)')?.osm,'way/500','il nome OSM alternativo va associato alla piazzetta, non segnato come mancante');
  assert.equal(map.squares.find(item=>item.name==='Piazza Jacopo Sannazaro')?.osm,'way/600','anche le aree taggate place=square devono conservare il riferimento OSM');
  assert.equal(map.landmarks.find(item=>item.name==='Piazza Sannazaro')?.osm,'way/600');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('la mappa Mergellina conserva ID OSM, origine metrica e nome locale separato',()=>{
 const map=JSON.parse(readFileSync(resolve(root,'client/assets/world/napoli/map/mergellina.json'),'utf8'));
 assert.deepEqual(map.origin,{lat:40.83025,lon:14.2175});
 assert.equal(map.scale,'1:1 (1 m del gioco = 1 m reale)');
 assert.match(map.attribution,/OpenStreetMap contributors.*ODbL/);
 assert.ok(map.buildings.every(building=>building.osm),'tutte le sagome hanno il riferimento OSM');
 assert.ok(map.roads.every(road=>road.osm),'tutti i tracciati hanno il riferimento OSM');
 const chalet=map.buildings.find(building=>building.osm==='way/1365095986');
 const cafe=map.pois.find(poi=>poi.osm==='node/2508856019');
 assert.equal(chalet?.displayName,'Chalet del Golfo');
 assert.equal(cafe?.displayName,'Chalet del Golfo');
 assert.ok(chalet?.p.length>=7,'l’impronta verificata del locale è conservata');
 const piazzetta=map.landmarks.find(item=>item.name==='Piazzetta del Leone (Mergellina)');
 assert.equal(piazzetta?.osm,'way/414634082');
 assert.equal(piazzetta?.missing,undefined);
 const sannazaro=map.landmarks.find(item=>item.name==='Piazza Sannazaro');
 assert.equal(map.squares.find(item=>item.name==='Piazza Jacopo Sannazaro')?.osm,'way/801374621');
 assert.equal(sannazaro?.osm,'way/801374621','la piazza usa il poligono del luogo, non il centroide di una strada omonima');
});
