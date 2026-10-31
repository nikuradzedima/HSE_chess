'use strict';

window.addEventListener('error', e => { const st = document.getElementById('status'); if (st) st.textContent = 'Ошибка: ' + e.message; });

const game = new Chess.Game();
const $ = id => document.getElementById(id);
const boardEl = $('board');

let selected = null, targets = [], lastMove = null;
let autoFlip = localStorage.getItem('chess-flip') === 'on';
let flipped = false;

document.documentElement.style.setProperty('--light', THEME.colors.light);
document.documentElement.style.setProperty('--dark', THEME.colors.dark);
$('title').textContent = document.title = THEME.title;

function pieceEl(p) {
  const key = p.c + p.t, img = THEME.pieces[key];
  const el = document.createElement('div');
  el.className = `piece ${p.c}`;
  el.dataset.key = key;
  const i = new Image(); i.alt = Chess.PIECES[p.t].name; i.draggable = false;
  i.src = img || PIECE_SVG(p.t, p.c);
  if (img) i.onerror = () => { i.onerror = null; i.src = PIECE_SVG(p.t, p.c); };
  el.appendChild(i);
  return el;
}

function render() {
  boardEl.innerHTML = '';
  boardEl.classList.toggle('flipped', flipped);
  const checkK = !game.result || game.result.reason === 'мат' ? (game.inCheck(game.turn) ? game.kingPos(game.turn) : null) : null;
  for (let i = 0; i < 64; i++) {
    const r = flipped ? 7 - Math.floor(i / 8) : Math.floor(i / 8);
    const c = flipped ? 7 - i % 8 : i % 8;
    const cell = document.createElement('div');
    cell.className = 'cell ' + ((r + c) % 2 ? 'dark' : 'light');
    cell.dataset.r = r; cell.dataset.c = c;
    if (lastMove && [lastMove.from, lastMove.to].some(([a, b]) => a === r && b === c)) cell.classList.add('last');
    if (selected && selected[0] === r && selected[1] === c) cell.classList.add('sel');
    if (checkK && checkK[0] === r && checkK[1] === c) cell.classList.add('check');
    const t = targets.find(m => m.to[0] === r && m.to[1] === c);
    if (t) cell.classList.add(t.capture ? 'hit' : 'dot');
    if ((flipped ? c === 7 : c === 0)) cell.insertAdjacentHTML('beforeend', `<span class="coord rank">${8 - r}</span>`);
    if ((flipped ? r === 0 : r === 7)) cell.insertAdjacentHTML('beforeend', `<span class="coord file">${'abcdefgh'[c]}</span>`);
    const p = game.board[r][c];
    if (p) cell.appendChild(pieceEl(p));
    boardEl.appendChild(cell);
  }

  for (const col of ['w', 'b']) {
    const box = $('p-' + col);
    box.classList.toggle('active', !game.result && game.turn === col);
    box.querySelector('.pname').textContent = THEME.names[col];
    const taken = box.querySelector('.taken'); taken.innerHTML = '';
    for (const t of game.captured[col]) {
      const e = pieceEl({ t, c: col === 'w' ? 'b' : 'w' }); e.classList.add('mini'); taken.appendChild(e);
    }
  }
  // Сторона хода внизу при перевороте
  document.querySelector('.table').classList.toggle('flipped', flipped);

  const st = $('status');
  if (game.result) st.textContent = game.result.winner ? `Победа: ${THEME.names[game.result.winner]} (${game.result.reason})` : `Ничья (${game.result.reason})`;
  else st.textContent = `Ход: ${THEME.names[game.turn]}` + (game.inCheck(game.turn) ? ' — шах!' : '');
  st.className = 'status ' + game.turn;

  const log = $('log'); log.innerHTML = '';
  for (let i = 0; i < game.log.length; i += 2)
    log.insertAdjacentHTML('beforeend', `<li><span>${game.log[i]}</span><span>${game.log[i + 1] || ''}</span></li>`);
  log.scrollTop = log.scrollHeight;
  $('btn-sound').textContent = Sound.enabled ? '🔊' : '🔇';
  $('btn-flip').classList.toggle('on', autoFlip);
}

function select(r, c) {
  const p = game.board[r]?.[c];
  if (p && p.c === game.turn && !game.result) {
    selected = [r, c]; targets = game.legalMoves(r, c);
    Sound.play('select', p.c + p.t);
    paintHighlights(); FX.select(r, c); return;
  } else { selected = null; targets = []; }
  paintHighlights();
}

// Обновить только подсветку, не пересоздавая клетки: иначе на телефоне
// палец «теряет» элемент, на который нажал, и касание обрывается.
function paintHighlights() {
  for (const cell of boardEl.children) {
    const r = +cell.dataset.r, c = +cell.dataset.c;
    const t = targets.find(m => m.to[0] === r && m.to[1] === c);
    cell.classList.toggle('sel', !!selected && selected[0] === r && selected[1] === c);
    cell.classList.toggle('dot', !!t && !t.capture);
    cell.classList.toggle('hit', !!t && !!t.capture);
  }
}

async function tryMove(r, c) {
  const opts = targets.filter(m => m.to[0] === r && m.to[1] === c);
  if (!opts.length) return false;
  let m = opts[0];
  if (m.promo) { const pick = await askPromo(game.turn); m = opts.find(o => o.promo === pick) || opts[0]; }
  const snap = FX.snapshot(m);
  const res = game.move(m);
  lastMove = m; selected = null; targets = [];
  const p = res.piece;
  Sound.play(res.event, p.c + (m.promo || p.t));
  if (autoFlip && !game.result) flipped = game.turn === 'b';
  render();
  try { FX.afterMove(snap, res, game); } catch (e) { console.error(e); }
  let comic = Promise.resolve();
  try { comic = Comic.afterMove(res, game); } catch (e) { console.error(e); }
  if (game.result) comic.then(() => setTimeout(showOver, Comic.enabled ? 300 : (game.result.reason === 'мат' ? 2200 : 600)));
  return true;
}

function askPromo(color) {
  return new Promise(res => {
    const d = $('promo'), box = d.querySelector('.choices');
    box.innerHTML = '';
    for (const t of ['Q', 'R', 'B', 'N']) {
      const b = document.createElement('button');
      b.appendChild(pieceEl({ t, c: color })); b.title = Chess.PIECES[t].name;
      b.onclick = () => { d.close(); res(t); };
      box.appendChild(b);
    }
    d.oncancel = e => e.preventDefault();
    d.showModal();
  });
}

function showOver() {
  const r = game.result;
  $('over-text').textContent = r.winner ? `${THEME.names[r.winner]} побеждают!` : 'Ничья';
  $('over-reason').textContent = r.reason[0].toUpperCase() + r.reason.slice(1);
  $('over').showModal();
}

function newGame() {
  Comic.close();
  game.reset(); selected = null; targets = []; lastMove = null; flipped = false;
  $('over').close(); Sound.play('start'); render();
}

// Клик и перетаскивание
let drag = null;
boardEl.addEventListener('pointerdown', e => {
  const cell = e.target.closest('.cell'); if (!cell) return;
  const r = +cell.dataset.r, c = +cell.dataset.c;
  if (selected && targets.some(m => m.to[0] === r && m.to[1] === c)) { tryMove(r, c); return; }
  const p = game.board[r][c];
  if (!p || p.c !== game.turn || game.result) {
    if (selected) { Sound.play('illegal'); FX.illegal(...selected); }
    select(-1, -1); return;
  }
  select(r, c);
  const pe = boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"] .piece`);
  if (pe) drag = { pe, r, c, x: e.clientX, y: e.clientY, moved: false };
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 5) drag.moved = true;
  if (drag.moved) { drag.pe.classList.add('dragging'); drag.pe.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`; }
});
window.addEventListener('pointercancel', () => { if (drag) { drag.pe.classList.remove('dragging'); drag.pe.style.transform = ''; drag = null; } });
window.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.moved) return;
  d.pe.style.visibility = 'hidden';
  const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cell');
  d.pe.style.visibility = '';
  d.pe.classList.remove('dragging'); d.pe.style.transform = '';
  if (!cell || (+cell.dataset.r === d.r && +cell.dataset.c === d.c)) return;
  tryMove(+cell.dataset.r, +cell.dataset.c).then(ok => { if (!ok) { Sound.play('illegal'); FX.illegal(d.r, d.c); } });
});

$('btn-new').onclick = () => { if (!game.log.length || game.result || confirm('Начать новую партию?')) newGame(); };
$('btn-again').onclick = newGame;
$('btn-undo').onclick = () => { game.undo(); selected = null; targets = []; lastMove = null; if (autoFlip) flipped = game.turn === 'b'; render(); };
$('btn-flip').onclick = () => { autoFlip = !autoFlip; localStorage.setItem('chess-flip', autoFlip ? 'on' : 'off'); flipped = autoFlip && game.turn === 'b'; render(); };
$('btn-sound').onclick = () => { Sound.toggle(); render(); };
$('btn-help').onclick = () => $('help').showModal();
$('btn-help-close').onclick = () => $('help').close();
$('btn-resign').onclick = () => { if (!game.result && confirm(`${THEME.names[game.turn]} сдаются?`)) { game.resign(game.turn); Sound.play('checkmate'); render(); FX.confetti(); setTimeout(showOver, 900); } };
$('btn-draw').onclick = () => { if (!game.result && confirm('Обе стороны согласны на ничью?')) { game.agreeDraw(); Sound.play('draw'); render(); showOver(); } };

render();
if (!localStorage.getItem('chess-seen-help')) { localStorage.setItem('chess-seen-help', '1'); $('help').showModal(); }

const comicBtn = () => { $('btn-comic').style.opacity = Comic.enabled ? 1 : .45; $('btn-comic').title = 'Комикс-вставки: ' + (Comic.enabled ? 'вкл' : 'выкл'); };
$('btn-comic').onclick = () => { Comic.toggle(); comicBtn(); };
comicBtn();
