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
