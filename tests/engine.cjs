const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/engine.js','utf8'),ctx);const Game=ctx.window.Chess.Game;
const g=new Game();assert.equal(g.board.length,10);assert.equal(g.board.flat().filter(p=>p?.c==='w'&&'QR'.includes(p.t)).length,2);
function empty(){const x=new Game();x.board=x.board.map(r=>r.map(()=>null));x.board[9][4]={t:'K',c:'w'};x.board[0][4]={t:'K',c:'b'};return x;}
const a=empty();a.board[5][3]={t:'N',c:'w'};a.board[5][4]={t:'B',c:'w'};a.board[4][3]={t:'Q',c:'w'};a.move(a.legalMoves(9,4)[0]);assert.equal(a.score.w,3);assert.equal(a.score.b,0);a.undo();assert.equal(a.score.w,0);assert.equal(a.plies,0);
const b=empty();b.plies=10;b.board[8][4]={t:'P',c:'w'};assert.equal(b.legalMoves(8,4).length,0);assert(b.legalMoves(9,4).some(m=>m.to[0]===8&&m.to[1]===4));
const c=empty();c.board[7][2]={t:'N',c:'w'};const swap=c.ultimateMoves().find(m=>m.to[0]===7);assert(swap);c.move(swap);assert.equal(c.board[7][2].t,'K');assert(c.ults.w);c.undo();assert(!c.ults.w);
const d=empty();d.turn='b';d.board[1][3]={t:'Q',c:'w'};const fish=d.ultimateMoves()[0];assert(fish);d.move(fish);assert.equal(d.board[1][3],null);assert(d.ults.b);d.undo();assert.equal(d.board[1][3].t,'Q');
const e=empty();e.score.w=15;e.board[5][3]={t:'N',c:'w'};e.move(e.legalMoves(9,4)[0]);assert.equal(e.result.winner,'w');
for(let i=0;i<10;i++){const moves=g.allLegal().filter(m=>!m.ult);assert(moves.length);g.move(moves[(i*7)%moves.length]);}assert.equal(g.plies,10);for(let r=0;r<10;r++)for(let c=0;c<8;c++)if(g.board[r][c]?.t==='P')assert.equal(g.pseudoMoves(r,c).length,0);
console.log('Passed: setup, scoring, undo, session, friendly capture, swap, fishing, victory, 10-ply game');
const f=empty();f.board[8][4]={t:'R',c:'b'};assert(f.inCheck('w'));assert(f.ultimateMoves().every(m=>{f._apply(m);const ok=!f.inCheck('w');f._undoRaw();return ok;}));
const h=empty();h.board[1][4]={t:'Q',c:'w'};assert(!h.pseudoMoves(1,4).some(m=>m.to[0]===0&&m.to[1]===4));
console.log('Passed: ultimate check safety and king capture exclusion');
// Session boundaries and undo must restore the exact rules in force.
const session=empty();session.board[8][0]={t:'P',c:'w'};session.plies=9;
assert(session.legalMoves(8,0).length);session.move(session.legalMoves(9,4)[0]);assert(session.sessionActive);assert.equal(session.sessionRemaining,4);
for(let i=0;i<4;i++){const k=session.kingPos(session.turn);session.move(session.legalMoves(...k)[0]);}
assert.equal(session.plies,14);assert(!session.sessionActive);assert(session.legalMoves(8,0).length===0 || session.turn==='w');assert(session.pseudoMoves(8,0).length);
session.undo();assert(session.sessionActive);assert.equal(session.sessionRemaining,1);assert.equal(session.pseudoMoves(8,0).length,0);
const friendly=empty();friendly.plies=10;friendly.board[8][4]={t:'P',c:'w'};friendly.move(friendly.legalMoves(9,4).find(m=>m.to[0]===8&&m.to[1]===4));assert.equal(friendly.captured.w[0].c,'w');
const illegal=new Game();const initial=JSON.stringify(illegal);assert.throws(()=>illegal.move({from:[8,0],to:[0,0]}));assert.equal(JSON.stringify(illegal),initial);
const win=empty();win.halfmove=99;win.score.w=15;win.board[5][3]={t:'N',c:'w'};const wr=win.move(win.legalMoves(9,4)[0]);assert.equal(win.result.reason,'контроль центра');assert.equal(wr.event,'zonewin');assert(!win.log[0].endsWith('#'));
const promo=empty();promo.board[1][0]={t:'P',c:'w'};promo.move(promo.legalMoves(1,0).find(m=>m.promo==='N'));assert.equal(promo.board[0][0].t,'N');promo.undo();assert.equal(promo.board[1][0].t,'P');
const ep=empty();ep.board[8][0]={t:'P',c:'w'};ep.board[6][1]={t:'P',c:'b'};ep.move(ep.legalMoves(8,0).find(m=>m.double));ep.move(ep.legalMoves(6,1).find(m=>m.enPassant));assert.equal(ep.board[6][0],null);ep.undo();assert.equal(ep.board[6][0].t,'P');
// Seeded full games: move generation must be read-only, every played move safe,
// and undo must recover board, score, session, abilities and repetition history.
let seed=12345;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};let count=0;
for(let run=0;run<12;run++){
 const x=new Game();x.limit=run%2?32:16;
 for(let ply=0;ply<100&&!x.result;ply++){
  const before=JSON.stringify(x), moves=x.allLegal();assert.equal(JSON.stringify(x),before);assert(moves.length);
  const move=moves[random()%moves.length],color=x.turn;x.move(move);count++;
  assert(!x.inCheck(color));assert.equal(x.board.flat().filter(p=>p?.t==='K').length,2);
  const after=JSON.stringify(x);x.undo();assert.equal(JSON.stringify(x),before);x.move(move);assert.equal(JSON.stringify(x),after);
 }
}
console.log(`Passed: session thaw/undo, capture colors, illegal move rejection, score precedence, promotion, en passant, ${count} seeded moves with replay/undo`);
const mate=empty();mate.board[0][4]=null;mate.board[9][4]=null;mate.board[0][0]={t:'K',c:'b'};mate.board[2][2]={t:'K',c:'w'};mate.board[1][2]={t:'Q',c:'w'};mate.ults.b=true;mate.move(mate.legalMoves(1,2).find(m=>m.to[0]===1&&m.to[1]===1));assert.equal(mate.result.reason,'мат');
const stale=empty();stale.board[0][4]=null;stale.board[9][4]=null;stale.board[0][0]={t:'K',c:'b'};stale.board[2][2]={t:'K',c:'w'};stale.board[2][3]={t:'Q',c:'w'};stale.ults.b=true;stale.move(stale.legalMoves(2,3).find(m=>m.to[0]===1&&m.to[1]===2));assert.equal(stale.result.reason,'пат');console.log('Passed: checkmate and stalemate');
