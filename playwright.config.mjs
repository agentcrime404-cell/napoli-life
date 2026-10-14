// Profili usati da scripts/qa-mobile.mjs e da eventuali test Playwright locali.
export const qaDevices=[
 {name:'android-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
 {name:'android-landscape-wide',viewport:{width:915,height:412},isMobile:true,hasTouch:true},
 {name:'android-landscape-xl',viewport:{width:932,height:430},isMobile:true,hasTouch:true},
];
export default {testDir:'./tests',timeout:30000,fullyParallel:false,reporter:'list',use:{headless:true,screenshot:'only-on-failure',video:'retain-on-failure',trace:'retain-on-failure'},projects:qaDevices.map(d=>({name:d.name,use:d}))};
