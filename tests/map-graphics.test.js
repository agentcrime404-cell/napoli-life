import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const w3=readFileSync(new URL('../client/world/world3d.js',import.meta.url),'utf8');
const extra=readFileSync(new URL('../client/world/merg-extra.js',import.meta.url),'utf8');
const city=readFileSync(new URL('../client/ui/city.js',import.meta.url),'utf8');

test('Mergellina: i dettagli veri (caserme, semafori, barche) non si fermano per una variabile mancante',()=>{
 const build=extra.slice(extra.indexOf(' build(){'),extra.indexOf(' buildCiro(){'));
 assert.match(build,/const gray=lam\(/,'build() usa gray: deve dichiararlo (prima ReferenceError e niente caserme/semafori/barche)');
 assert.match(city,/import \{FUEL,/,'city.js usa FUEL ogni fotogramma: deve importarlo');
});

test('i cartelli si leggono da entrambi i lati e non tagliano CARBURANTE',()=>{
 assert.doesNotMatch(extra,/side:THREE\.DoubleSide\}\)\);\}/,'una sola faccia DoubleSide mostra la scritta a specchio');
 assert.match(extra,/back\.rotation\.y=Math\.PI/);
 assert.match(extra,/while\(!fit\(\)&&size>/,'il testo si rimpicciolisce prima di essere tagliato');
});

test('palazzi, piazze e modelli dedicati restano appoggiati al terreno',()=>{
 assert.match(w3,/rec\.baseY=pts\.reduce\(\(m,p\)=>Math\.min\(m,this\.terrainHeight/,'base del palazzo al punto più basso dell’impronta');
 assert.match(w3,/const d=this\.terrainHeight\(pa\.getX\(i\),pa\.getZ\(i\)\)-base/,'le piazze seguono il pendio');
 assert.match(w3,/inCustom\(pts\.reduce/,'parti OSM dentro chiesa e Castel dell’Ovo non diventano palazzi generici');
 assert.match(w3,/cx>2480&&cx<2720&&cy>120&&cy<430\)return 1\+sd%3/,'Borgo Marinari resta basso');
});

test('ringhiera e scogli del lungomare sono a tessere, non disegnati sempre per intero',()=>{
 assert.doesNotMatch(w3,/rocks\.frustumCulled=false/,'gli scogli erano un unico blocco disegnato sempre (~180.000 triangoli)');
 assert.doesNotMatch(w3,/for\(const m of \[posts,balls,r1,r2\]\)\{m\.frustumCulled=false/,'la ringhiera era disegnata sempre per intero (~240.000 triangoli)');
 assert.match(w3,/TILE=100,tileOf=/);
 assert.match(w3,/m\.frustumCulled=true;m\.userData\.zone=true;Z\.add\(m\)/,'ogni tessera si spegne fuori inquadratura e oltre la distanza');
});
