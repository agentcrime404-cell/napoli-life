const fs=require('fs');const s=fs.readFileSync('client/world/world3d.js','utf8');const i=s.indexOf('travelBtn');console.log(i);console.log(s.slice(i-80,i+100));
