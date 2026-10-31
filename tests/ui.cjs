// Run with jsdom and @sinonjs/fake-timers installed (NODE_PATH may point to them).
const {JSDOM,VirtualConsole}=require('jsdom');const FakeTimers=require('@sinonjs/fake-timers');const vm=require('node:vm');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',e=>errors.push(String(e)));
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'http://localhost/',runScripts:'outside-only',virtualConsole:vc});const w=dom.window;
const clock=FakeTimers.withGlobal(w).install({toFake:['setTimeout','clearTimeout','Date']});
w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
w.Element.prototype.animate=function(frames,options){const a={onfinish:null,cancel(){w.clearTimeout(id)}};const id=w.setTimeout(()=>a.onfinish?.(),typeof options==='number'?options:options.duration||0);return a;};
w.confirm=()=>true;w.AudioContext=class {constructor(){this.state='running';this.currentTime=0;this.destination={}}createOscillator(){return {frequency:{},connect(){return this},start(){},stop(){}}}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this}}}};
for(const path of ['theme.js','characters.js','js/engine.js','js/pieces.js','js/fx.js','js/comic.js','js/sound.js','js/duel.js','js/ui.js'])vm.runInContext(fs.readFileSync(path,'utf8'),dom.getInternalVMContext());
const $=id=>w.document.getElementById(id), ev=s=>vm.runInContext(s,dom.getInternalVMContext());
const shots=[],soundCalls=[];ev('Sound').play=(event,key)=>{shots.push(event);soundCalls.push([event,key]);};
assert.equal($('board').querySelectorAll('.cell').length,64);assert.equal($('board').querySelectorAll('.piece').length,2);
$('limit').value='32';$('duel-gas').click();await clock.tickAsync(1);
assert.equal($('board').querySelectorAll('.duel-gun').length,2);assert.equal($('board').querySelectorAll('.duel-lasers').length,1);
ev('duel()');assert.equal($('board').querySelectorAll('.duel-lasers').length,1);
await clock.tickAsync(5999);assert.equal(shots.filter(x=>x==='laser').length,12);assert.equal($('board').querySelectorAll('.duel-gun,.duel-lasers').length,0);
assert.equal($('scene').hidden,false);await clock.tickAsync(3100);
assert.equal($('board').querySelectorAll('.cell').length,80);assert.equal($('board').querySelectorAll('.piece').length,32);assert.equal(ev('game.limit'),32);assert.equal(ev('busy'),false);
$('btn-new').click();assert.equal($('board').querySelectorAll('.cell').length,64);$('limit').value='16';$('duel-go').click();await clock.tickAsync(9200);assert.equal(ev('game.limit'),16);
// Play a complete deterministic legal game through the real UI handler.
const replay=JSON.parse(fs.readFileSync('tests/fixtures/game.json','utf8'));
for(const row of replay){
 const m=row.m;w.testMove=m;
 ev('selected=testMove.from; targets=testMove.ult?game.ultimateMoves():game.legalMoves(...testMove.from);');
 ev('tryMove(...testMove.to)');await clock.tickAsync(9000);
 assert.equal(ev('busy'),false);assert.equal(ev('game.plies'),row.ply);
 if(row.ply===10)assert($('board').querySelector('.frozen'));
 if(row.ply===14)assert.equal($('board').querySelectorAll('.frozen').length,0);
}
assert.equal(ev('game.result.reason'),'контроль центра');assert($('over').hasAttribute('open'));assert($('over-reason').textContent.includes('Контроль'));
$('over').close();$('btn-undo').click();assert.equal(ev('game.result'),null);assert.equal(ev('game.plies'),18);
// New game resets scores, ability consumption and session.
$('btn-new').click();$('duel-go').click();await clock.tickAsync(9200);assert.equal(ev('game.score.w'),0);assert.equal(ev('game.ults.w'),false);assert.equal(ev('game.plies'),0);
// Fishing, including a friendly pawn and two hostile pieces, through its button.
ev("game.board=Array.from({length:10},()=>Array(8).fill(null));game.board[0][4]={t:'K',c:'b'};game.board[9][4]={t:'K',c:'w'};game.board[1][3]={t:'Q',c:'w'};game.board[1][4]={t:'P',c:'b'};game.board[1][5]={t:'N',c:'w'};game.turn='b';render();");
const eatBefore=soundCalls.filter(c=>c[0]==='capture'&&c[1]==='bK').length;
$('btn-ult').click();await clock.tickAsync(9500);assert.equal(soundCalls.filter(c=>c[0]==='capture'&&c[1]==='bK').length,eatBefore+1);assert.equal(ev('game.captured.b.length'),2);assert.equal(ev('game.board[1][4].c'),'b');assert.equal(ev('game.ults.b'),true);
$('btn-undo').click();assert.equal(ev('game.ults.b'),false);assert.equal(ev('game.board[1][3].t'),'Q');
// Ordinary Mishan capture must use his voice even when it wins by center score.
ev("game.board=Array.from({length:10},()=>Array(8).fill(null));game.board[4][3]={t:'K',c:'b'};game.board[9][0]={t:'K',c:'w'};game.board[4][4]={t:'N',c:'w'};game.turn='b';game.score.b=15;selected=[4,3];targets=game.legalMoves(4,3);render();tryMove(4,4);");
await clock.tickAsync(9000);assert.equal(ev('game.result.reason'),'контроль центра');assert(soundCalls.some(c=>c[0]==='capture'&&c[1]==='bK'));assert.equal(soundCalls.filter(c=>c[0]==='capture'&&c[1]==='bK').length,eatBefore+2);
$('over').close();$('btn-undo').click();
// Both Nina queens share the same capture voice, including a winning capture.
for(const column of [0,7]) {
 const beforeNina=soundCalls.filter(c=>c[0]==='capture'&&c[1]==='wR').length;
 ev(`game.reset();game.board=Array.from({length:10},()=>Array(8).fill(null));game.board[9][4]={t:'K',c:'w'};game.board[0][4]={t:'K',c:'b'};game.board[5][${column}]={t:'R',c:'w'};game.board[5][3]={t:'N',c:'b'};game.score.w=15;selected=[5,${column}];targets=game.legalMoves(...selected);render();tryMove(5,3);`);
 await clock.tickAsync(9000);assert.equal(ev('game.result.reason'),'контроль центра');assert.equal(soundCalls.filter(c=>c[0]==='capture'&&c[1]==='wR').length,beforeNina+1);$('over').close();$('btn-undo').click();
}
// Comic impact audio follows panel timing and skips pending sounds on dismissal.
const comicBefore=soundCalls.length;
ev("Comic.afterMove({move:{},piece:{c:'w',t:'Q'},taken:{c:'b',t:'N'},event:'capture'},game)");
await clock.tickAsync(799);assert.equal(soundCalls.length,comicBefore);
await clock.tickAsync(1);assert.equal(soundCalls.at(-1)[0],'comicPunch');
await clock.tickAsync(1000);assert.equal(soundCalls.at(-1)[0],'comicHurt');
ev('Comic.close()');await clock.tickAsync(6000);
assert.equal(soundCalls.length,comicBefore+2);
ev("Comic.afterMove({move:{},piece:{c:'w',t:'Q'},taken:{c:'b',t:'N'},event:'capture'},game)");
await clock.tickAsync(800);const beforeSkip=soundCalls.length;
ev('Comic.close()');await clock.tickAsync(6000);assert.equal(soundCalls.length,beforeSkip);
// Resignation and draw dialogs.
$('btn-resign').click();await clock.tickAsync(1000);assert.equal(ev('game.result.reason'),'сдача');$('over').close();$('btn-new').click();$('duel-go').click();await clock.tickAsync(9200);$('btn-draw').click();assert.equal(ev('game.result.reason'),'соглашение');
assert.deepEqual(errors,[]);clock.uninstall();w.close();console.log('PASS UI: both starts, 12 shots, double-start guard, effect cleanup, 32/16 limits, full 19-ply game, session/thaw, score victory, undo, restart, fishing, resignation, draw; no runtime errors');
})().catch(e=>{console.error(e);process.exit(1)});
