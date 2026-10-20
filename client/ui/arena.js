// Legacy compatibility shim. The social-life edition has no arena or combat HUD.
// app.js still calls update() each frame so old startup wiring remains harmless.
export function installArena(){
 return {update(){}};
}
