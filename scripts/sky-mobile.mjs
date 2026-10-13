import {readFile,writeFile} from 'node:fs/promises';
import {createCanvas,ImageData} from '@napi-rs/canvas';
import * as THREE from '../client/vendor/three/three.module.min.js';
import {RGBELoader} from '../client/vendor/three/RGBELoader.js';
const base=new URL('../client/assets/world/napoli/lighting/sky/',import.meta.url),bytes=await readFile(new URL('kloofendal_48d_partly_cloudy_puresky.hdr',base));
const image=new RGBELoader().setDataType(THREE.FloatType).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const pixels=new Uint8ClampedArray(image.width*image.height*4),aces=value=>Math.max(0,Math.min(1,(value*(2.51*value+.03))/(value*(2.43*value+.59)+.14))),srgb=value=>value<=.0031308?value*12.92:1.055*Math.pow(value,1/2.4)-.055;
for(let i=0;i<pixels.length;i+=4){for(let c=0;c<3;c++)pixels[i+c]=Math.round(255*srgb(aces(image.data[i+c]*.95)));pixels[i+3]=255;}
const source=createCanvas(image.width,image.height);source.getContext('2d').putImageData(new ImageData(pixels,image.width,image.height),0,0);
const mobile=createCanvas(1024,512),context=mobile.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(source,0,0,1024,512);
const jpg=mobile.toBuffer('image/jpeg',86);await writeFile(new URL('kloofendal-mobile.jpg',base),jpg);
console.log('Cielo mobile: 1024×512, '+Math.round(jpg.length/1024)+' KB; fonte Poly Haven CC0');
