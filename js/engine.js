// Движок правил. Фигуры описаны данными (PIECES), чтобы потом легко добавить
// свою механику: новые типы, наследование способностей, исчезающие клетки.
'use strict';

const ORTHO = [[1,0],[-1,0],[0,1],[0,-1]];
const DIAG  = [[1,1],[1,-1],[-1,1],[-1,-1]];
const KNIGHT = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];

// slide — луч до упора, leap — один прыжок. Пешка и король (рокировка) — особые.
const PIECES = {
  K: { name: 'Король', leap: [...ORTHO, ...DIAG] },
  Q: { name: 'Ферзь',  slide: [...ORTHO, ...DIAG] },
  R: { name: 'Ферзь',  slide: [...ORTHO, ...DIAG] },
  B: { name: 'Слон',   slide: DIAG },
  N: { name: 'Конь',   leap: KNIGHT },
  P: { name: 'Пешка',  pawn: true },
};

const FILES = 'abcdefgh';
const sq = (r, c) => FILES[c] + (10 - r);
const inside = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 8;

class Game {
  constructor() { this.reset(); }

  reset() {
    const back = ['R','N','B','Q','K','B','N',null];
    this.board = Array.from({ length: 10 }, () => Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = back[c] ? { t: back[c], c: 'b' } : null;
      this.board[1][c] = { t: 'P', c: 'b' };
      this.board[8][c] = { t: 'P', c: 'w' };
      this.board[9][c] = back[c] ? { t: back[c], c: 'w' } : null;
    }
    this.turn = 'w';
    this.score = {w:0,b:0}; this.plies = 0; this.ults = {w:false,b:false}; this.limit = this.limit || 16;
    this.castle = { w: { k: false, q: false }, b: { k: false, q: false } };
    this.ep = null;            // клетка для взятия на проходе [r,c]
    this.halfmove = 0;
    this.history = [];         // для отмены
    this.log = [];             // запись ходов
    this.positions = {};
    this.captured = { w: [], b: [] }; // кто что съел
    this.result = null;
    this._remember();
  }

  get sessionActive() { return this.plies >= 10 && this.plies < 14; }
  get sessionRemaining() { return this.sessionActive ? 14 - this.plies : 0; }

  at(r, c) { return inside(r, c) ? this.board[r][c] : undefined; }

  // Атакована ли клетка цветом by
  attacked(r, c, by) {
    const dir = by === 'w' ? 1 : -1; // откуда бьёт пешка
    for (const dc of [-1, 1]) {
      const p = this.at(r + dir, c + dc);
      if (p && p.c === by && p.t === 'P') return true;
    }
    for (const [t, def] of Object.entries(PIECES)) {
      if (def.leap) for (const [dr, dc] of def.leap) {
        const p = this.at(r + dr, c + dc);
        if (p && p.c === by && p.t === t) return true;
      }
      if (def.slide) for (const [dr, dc] of def.slide) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc)) {
          const p = this.board[rr][cc];
          if (p) { if (p.c === by && p.t === t) return true; break; }
          rr += dr; cc += dc;
        }
      }
    }
    return false;
  }

  kingPos(color) {
    for (let r = 0; r < 10; r++) for (let c = 0; c < 8; c++) {
      const p = this.board[r][c];
      if (p && p.t === 'K' && p.c === color) return [r, c];
    }
    return null;
  }

  inCheck(color) {
    const k = this.kingPos(color);
    return k ? this.attacked(k[0], k[1], color === 'w' ? 'b' : 'w') : false;
  }

  pseudoMoves(r, c) {
    const p = this.board[r][c]; if (!p) return [];
    const def = PIECES[p.t], out = [];
    const add = (tr, tc, extra = {}) => out.push({ from: [r, c], to: [tr, tc], piece: p.t, ...extra });

    if (def.pawn) {
      if (this.sessionActive) return out;
      const d = p.c === 'w' ? -1 : 1, start = p.c === 'w' ? 8 : 1, last = p.c === 'w' ? 0 : 9;
      const push = (tr, tc, extra) => tr === last
        ? ['Q','R','B','N'].forEach(t => add(tr, tc, { ...extra, promo: t }))
        : add(tr, tc, extra);
      if (this.at(r + d, c) === null) {
        push(r + d, c);
        if (r === start && this.at(r + 2 * d, c) === null) add(r + 2 * d, c, { double: true });
      }
      for (const dc of [-1, 1]) {
        const t = this.at(r + d, c + dc);
        if (t && t.t !== 'K' && (t.c !== p.c || (this.sessionActive && t.t === 'P'))) push(r + d, c + dc, { capture: true });
        if (this.ep && this.ep[0] === r + d && this.ep[1] === c + dc) add(r + d, c + dc, { capture: true, enPassant: true });
      }
      return out;
    }
    if (def.leap) for (const [dr, dc] of def.leap) {
      const t = this.at(r + dr, c + dc);
      if (t === null) add(r + dr, c + dc);
      else if (t && t.t !== 'K' && (t.c !== p.c || (this.sessionActive && t.t === 'P'))) add(r + dr, c + dc, { capture: true });
    }
    if (def.slide) for (const [dr, dc] of def.slide) {
      let rr = r + dr, cc = c + dc;
      while (inside(rr, cc)) {
        const t = this.board[rr][cc];
        if (!t) add(rr, cc);
        else { if (t.t !== 'K' && (t.c !== p.c || (this.sessionActive && t.t === 'P'))) add(rr, cc, { capture: true }); break; }
        rr += dr; cc += dc;
      }
    }
    if (p.t === 'K') {
      const row = p.c === 'w' ? 9 : 0, enemy = p.c === 'w' ? 'b' : 'w', cr = this.castle[p.c];
      if (r === row && c === 4 && !this.attacked(row, 4, enemy)) {
        if (cr.k && !this.board[row][5] && !this.board[row][6] && this.board[row][7]?.t === 'R'
            && !this.attacked(row, 5, enemy) && !this.attacked(row, 6, enemy)) add(row, 6, { castle: 'k' });
        if (cr.q && !this.board[row][3] && !this.board[row][2] && !this.board[row][1] && this.board[row][0]?.t === 'R'
            && !this.attacked(row, 3, enemy) && !this.attacked(row, 2, enemy)) add(row, 2, { castle: 'q' });
      }
    }
    return out;
  }

  legalMoves(r, c) {
    const p = this.board[r][c];
    if (!p || p.c !== this.turn || this.result) return [];
    return this.pseudoMoves(r, c).filter(m => {
      this._apply(m);
      const ok = !this.inCheck(p.c);
      this._undoRaw();
      return ok;
    });
  }

  ultimateMoves() {
    if(this.result || this.ults[this.turn]) return [];
    const from=this.kingPos(this.turn), out=[]; if(!from) return out;
    const candidates=this.turn==='w' ? this.board.flatMap((row,r)=>row.map((p,c)=>p && p.t!=='K' ? [r,c]:null).filter(Boolean)) : [from];
    for(const to of candidates) {
      const m={from,to,piece:'K',ult:true}; const color=this.turn;
      this._apply(m); const safe=!this.inCheck(color); this._undoRaw();
      if(safe) out.push(m);
    }
    return out;
  }
  allLegal() {
    const res = this.ultimateMoves();
    for (let r = 0; r < 10; r++) for (let c = 0; c < 8; c++)
      if (this.board[r][c]?.c === this.turn) res.push(...this.legalMoves(r, c));
    return res;
  }

  // Применить ход без проверок; состояние сохраняется для отмены
  _apply(m) {
    const snapshot = JSON.parse(JSON.stringify({
      board: this.board, turn: this.turn, castle: this.castle, ep: this.ep,
      halfmove: this.halfmove, captured: this.captured, result: this.result,
      log: this.log.length, score:this.score, plies:this.plies, ults:this.ults,
    }));
    snapshot.positions = this.positions; // Repetition maps are immutable; do not copy them for every candidate.
    this.history.push(snapshot);
    const [fr, fc] = m.from, [tr, tc] = m.to, p = this.board[fr][fc];
    if (m.ult) {
      this.ults[p.c] = true;
      if (p.c === 'w') { this.board[fr][fc]=this.board[tr][tc]; this.board[tr][tc]=p; }
      else for (let r=Math.max(0,fr-1);r<=Math.min(9,fr+1);r++) for(let c=Math.max(0,fc-1);c<=Math.min(7,fc+1);c++) { const q=this.board[r][c]; if(q && q.c!==p.c && q.t!=='K') { this.captured[p.c].push({...q}); this.board[r][c]=null; } }
      this.ep=null; this.halfmove=0; this.turn=p.c==='w'?'b':'w'; return null;
    }
    let taken = this.board[tr][tc];
    if (m.enPassant) { taken = this.board[fr][tc]; this.board[fr][tc] = null; }
    if (taken) this.captured[p.c] = [...this.captured[p.c], {...taken}];
    this.board[tr][tc] = m.promo ? { t: m.promo, c: p.c } : p;
    this.board[fr][fc] = null;
    if (m.castle) {
      const row = fr, [rf, rt] = m.castle === 'k' ? [7, 5] : [0, 3];
      this.board[row][rt] = this.board[row][rf]; this.board[row][rf] = null;
    }
    const cr = this.castle = JSON.parse(JSON.stringify(this.castle));
    if (p.t === 'K') cr[p.c] = { k: false, q: false };
    for (const [r, c, col, side] of [[7,0,'w','q'],[7,7,'w','k'],[0,0,'b','q'],[0,7,'b','k']])
      if ((fr === r && fc === c) || (tr === r && tc === c)) cr[col][side] = false;
    this.ep = m.double ? [(fr + tr) / 2, fc] : null;
    this.halfmove = (p.t === 'P' || taken) ? 0 : this.halfmove + 1;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    return taken;
  }

  _undoRaw() {
    const s = this.history.pop();
    Object.assign(this, { board: s.board, turn: s.turn, castle: s.castle, ep: s.ep,
      halfmove: s.halfmove, captured: s.captured, result: s.result, positions: s.positions, score:s.score, plies:s.plies, ults:s.ults });
    this.log.length = s.log;
  }

  _remember() {
    const key = JSON.stringify([this.board, this.turn, this.castle, this.ep, this.score, this.ults, Math.min(this.plies, 14)]);
    this.positions = { ...this.positions, [key]: (this.positions[key] || 0) + 1 };
    return this.positions[key];
  }

  // Публичный ход. Возвращает описание события для звука/анимации.
  move(m) {
    if (!m || !Array.isArray(m.from) || !Array.isArray(m.to) || !inside(...m.from) || !inside(...m.to)) throw new Error('Недопустимый ход');
    const legal = m.ult ? this.ultimateMoves() : this.legalMoves(...m.from);
    const valid = legal.find(x => x.to[0]===m.to[0] && x.to[1]===m.to[1] && x.promo===m.promo && !!x.ult===!!m.ult);
    if (!valid) throw new Error('Недопустимый ход');
    m = valid;
    const p = this.board[m.from[0]][m.from[1]];
    const san = this._san(m);
    const taken = this._apply(m);
    this.plies++;
    if(this.sessionActive) this.ep=null;
    this.score[p.c] += this.board.slice(4,6).reduce((n,row)=>n+row.slice(3,5).filter(q=>q?.c===p.c).length,0);
    const reps = this._remember();
    const check = this.inCheck(this.turn);
    const noMoves = this.allLegal().length === 0;
    let event = taken ? 'capture' : 'move';
    if (m.castle) event = 'castle';
    if (m.promo) event = 'promote';
    if (noMoves && check) { this.result = { winner: p.c, reason: 'мат' }; event = 'checkmate'; }
    else if (this.score[p.c] >= this.limit) { this.result={winner:p.c,reason:'контроль центра'}; event='zonewin'; }
    else if (noMoves) { this.result = { winner: null, reason: 'пат' }; event = 'draw'; }
    else if (this.halfmove >= 100) { this.result = { winner: null, reason: 'правило 50 ходов' }; event = 'draw'; }
    else if (reps >= 3) { this.result = { winner: null, reason: 'троекратное повторение' }; event = 'draw'; }
    else if (check) event = 'check';
    this.log.push(san + (event === 'checkmate' ? '#' : check ? '+' : ''));
    return { event, piece: p, taken, move: m };
  }

  undo() { if (this.history.length) this._undoRaw(); }

  resign(color) { this.result = { winner: color === 'w' ? 'b' : 'w', reason: 'сдача' }; }
  agreeDraw() { this.result = { winner: null, reason: 'соглашение' }; }

  _bareKings() {
    const rest = this.board.flat().filter(p => p && p.t !== 'K');
    return rest.length === 0 || (rest.length === 1 && 'BN'.includes(rest[0].t));
  }

  _san(m) {
    if (m.ult) return this.turn==='w'?'Сигма ↔ '+sq(...m.to):'Рыбалка';
    if (m.castle) return m.castle === 'k' ? 'O-O' : 'O-O-O';
    const p = this.board[m.from[0]][m.from[1]];
    const pre = p.t === 'P' ? (m.capture ? FILES[m.from[1]] : '') : p.t;
    return pre + (m.capture ? 'x' : '') + sq(...m.to) + (m.promo ? '=' + m.promo : '');
  }
}

window.Chess = { Game, PIECES, sq };
