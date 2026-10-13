// Pausa breve tra un pezzo di lavoro e l'altro: lascia respirare la pagina senza usare setTimeout.
// I timer da 0 ms il browser li può rallentare fino a uno al secondo (scheda in secondo piano); con centinaia di pause la città restava ferma.
// In Node (test) la porta tiene vivo il processo solo mentre c'è una pausa in corso: ref/unref non esistono nel browser.
const ch=typeof MessageChannel==='function'?new MessageChannel():null,queue=[];
if(ch){ch.port1.onmessage=()=>{const r=queue.shift();if(!queue.length)ch.port1.unref?.();if(r)r();};ch.port1.unref?.();}
export function nextTask(){return new Promise(r=>{if(!ch)return setTimeout(r,0);queue.push(r);ch.port1.ref?.();ch.port2.postMessage(0);});}
