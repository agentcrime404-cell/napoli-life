// Profili usati da scripts/qa-mobile.mjs e da eventuali test Playwright locali.
export const qaDevices=[
 {name:'android-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
 {name:'android-small-portrait',viewport:{width:360,height:800},isMobile:true,hasTouch:true},
 {name:'android-compact',viewport:{width:320,height:640},isMobile:true,hasTouch:true},
 {name:'android-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
 {name:'android-landscape-small',viewport:{width:740,height:360},isMobile:true,hasTouch:true},
];
export default {testDir:'./tests',timeout:30000,fullyParallel:false,reporter:'list',use:{headless:true,screenshot:'only-on-failure',video:'retain-on-failure',trace:'retain-on-failure'},projects:qaDevices.map(d=>({name:d.name,use:d}))};
