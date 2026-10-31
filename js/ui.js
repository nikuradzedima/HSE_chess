'use strict';

window.addEventListener('error', e => { const st = document.getElementById('status'); if (st) st.textContent = 'Ошибка: ' + e.message; });

const game = new Chess.Game();
const $ = id => document.getElementById(id);
const boardEl = $('board');

let busy = true, ultMode = false;
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
  el.dataset.key = key; el.title = CHARACTERS[key]?.name || Chess.PIECES[p.t].name;
  if(img) el.classList.add('portrait');
  const i = new Image(); i.alt = CHARACTERS[key]?.name || Chess.PIECES[p.t].name; i.draggable = false;
  i.src = img || PIECE_SVG(p.t, p.c);
  if (img) i.onerror = () => { i.onerror = null; i.src = PIECE_SVG(p.t, p.c); };
  if(img) { const shape=new Image(); shape.src=PIECE_SVG(p.t==='R'?'Q':p.t,p.c); shape.alt=''; shape.draggable=false; shape.className='piece-outline'; el.appendChild(shape); i.className='piece-face'; }
  el.appendChild(i);
  return el;
}

function render() {
  boardEl.innerHTML = '';
  boardEl.classList.toggle('flipped', flipped);
  const checkK = !game.result || game.result.reason === 'мат' ? (game.inCheck(game.turn) ? game.kingPos(game.turn) : null) : null;
  for (let i = 0; i < 80; i++) {
    const r = flipped ? 9 - Math.floor(i / 8) : Math.floor(i / 8);
    const c = flipped ? 7 - i % 8 : i % 8;
    const cell = document.createElement('div');
    cell.className = 'cell ' + ((r + c) % 2 ? 'dark' : 'light');
    if(r>=4 && r<=5 && c>=3 && c<=4) cell.classList.add('zone',`zone-${r}-${c}`);
    cell.dataset.r = r; cell.dataset.c = c;
    if (lastMove && [lastMove.from, lastMove.to].some(([a, b]) => a === r && b === c)) cell.classList.add('last');
    if (selected && selected[0] === r && selected[1] === c) cell.classList.add('sel');
    if (checkK && checkK[0] === r && checkK[1] === c) cell.classList.add('check');
    const t = targets.find(m => m.to[0] === r && m.to[1] === c);
    if (t) cell.classList.add(t.capture ? 'hit' : 'dot');
    if ((flipped ? c === 7 : c === 0)) cell.insertAdjacentHTML('beforeend', `<span class="coord rank">${10 - r}</span>`);
    if ((flipped ? r === 0 : r === 9)) cell.insertAdjacentHTML('beforeend', `<span class="coord file">${'abcdefgh'[c]}</span>`);
    const p = game.board[r][c];
    if (p) { cell.appendChild(pieceEl(p)); if(p.t==='P' && game.sessionActive) cell.classList.add('frozen'); }
    boardEl.appendChild(cell);
  }

  for (const col of ['w', 'b']) {
    const box = $('p-' + col);
    box.classList.toggle('active', !game.result && game.turn === col);
    box.querySelector('.pname').textContent = THEME.names[col] + ` · ${game.score[col]} / ${game.limit}`;
    const taken = box.querySelector('.taken'); taken.innerHTML = '';
    for (const captured of game.captured[col]) {
      const e = pieceEl(captured); e.classList.add('mini'); taken.appendChild(e);
    }
  }
  // Сторона хода внизу при перевороте
  document.querySelector('.table').classList.toggle('flipped', flipped);

  $('session').textContent = game.sessionActive ? `❄ Сессия: ходов до конца — ${game.sessionRemaining}. Пешки заморожены; своих можно брать.` : game.plies>=14 ? '✓ Сессия окончена. Пешки снова ходят.' : `До сессии: ${10-game.plies} ходов`;
  $('btn-ult').disabled = busy || !!game.result || !game.ultimateMoves().length;
  $('btn-ult').textContent = game.turn==='w' ? 'Ульта Соколова · обмен' : 'Ульта Мишана · рыбалка';
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
    if(p.t==='P' && game.sessionActive) $('status').textContent=`Пешка заморожена: ходов до конца сессии — ${game.sessionRemaining}`;
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
  if(busy) return false;
  const opts = targets.filter(m => m.to[0] === r && m.to[1] === c);
  if (!opts.length) return false;
  let m = opts[0];
  if (m.promo) { busy=true; const pick = await askPromo(game.turn); m = opts.find(o => o.promo === pick) || opts[0]; busy=false; }
  busy=true;
  if(m.ult) await ultimateScene(m);
  let snap;
  try { snap = FX.snapshot(m); } catch(e) { console.error(e); }
  let res;
  try { res=game.move(m); } catch(e) { busy=false; selected=null; targets=[]; render(); return false; }
  ultMode=false; lastMove = m; selected = null; targets = [];
  const p = res.piece;
  Sound.play(res.event, p.c + (m.promo || p.t));
  if (autoFlip && !game.result) flipped = game.turn === 'b';
  render();
  try { if(snap) FX.afterMove(snap, res, game); } catch (e) { console.error(e); }
  let comic = Promise.resolve();
  try { comic = Comic.afterMove(res, game); } catch (e) { console.error(e); }
  await comic;
  busy=false; render();
  if (game.result) showOver();
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
  if(!r || busy) return;
  $('over-text').textContent = r.winner ? `${THEME.names[r.winner]} побеждают!` : 'Ничья';
  $('over-reason').textContent = r.reason[0].toUpperCase() + r.reason.slice(1);
  $('over').showModal();
}

function newGame() {
  if(busy) return;
  Comic.close();
  game.reset(); selected = null; targets = []; lastMove = null; flipped = false;
  $('over').close(); game.limit=+$('limit').value; Sound.play('start'); render(); startIntro();
}

// Клик и перетаскивание
let drag = null;
boardEl.addEventListener('pointerdown', e => {
  if(busy) return;
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

$('btn-new').onclick = () => { if(busy) return; if (!game.log.length || game.result || confirm('Начать новую партию?')) newGame(); };
$('btn-again').onclick = newGame;
$('btn-undo').onclick = () => { if(busy) return; game.undo(); selected = null; targets = []; lastMove = null; if (autoFlip) flipped = game.turn === 'b'; render(); };
$('btn-flip').onclick = () => { if(busy) return; autoFlip = !autoFlip; localStorage.setItem('chess-flip', autoFlip ? 'on' : 'off'); flipped = autoFlip && game.turn === 'b'; render(); };
$('btn-sound').onclick = () => { Sound.toggle(); if(!Sound.enabled && 'speechSynthesis' in window) speechSynthesis.cancel(); $('btn-sound').textContent=Sound.enabled?'🔊':'🔇'; };
$('btn-help').onclick = () => $('help').showModal();
$('btn-help-close').onclick = () => $('help').close();
$('btn-resign').onclick = () => { if (!busy && !game.result && confirm(`${THEME.names[game.turn]} сдаются?`)) { game.resign(game.turn); Sound.play('checkmate'); render(); FX.confetti(); setTimeout(showOver, 900); } };
$('btn-draw').onclick = () => { if (!busy && !game.result && confirm('Обе стороны согласны на ничью?')) { game.agreeDraw(); Sound.play('draw'); render(); showOver(); } };

render();


const comicBtn = () => { $('btn-comic').style.opacity = Comic.enabled ? 1 : .45; $('btn-comic').title = 'Комикс-вставки: ' + (Comic.enabled ? 'вкл' : 'выкл'); };
$('btn-comic').onclick = () => { Comic.toggle(); comicBtn(); };
comicBtn();

const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
function say(text) {
  if(Sound.enabled && 'speechSynthesis' in window) { const u=new SpeechSynthesisUtterance(text); u.lang='ru-RU'; speechSynthesis.speak(u); }
}
function face(key) { const img=new Image(); img.src=THEME.pieces[key]; img.alt=CHARACTERS[key].name; img.className='scene-face'; return img; }
async function ultimateScene(m) {
  const stage=$('scene'); stage.replaceChildren(); stage.hidden=false;
  const title=document.createElement('h2'); title.textContent='Внимание! '+(game.turn==='w'?'Сигма-перестановка':'Мишан выходит на рыбалку'); stage.append(title,face(game.turn+'K'));
  Sound.play('check'); say('Внимание!'); await pause(700);
  if(game.turn==='b') {
    const fishes=document.createElement('div'); fishes.className='fishes';
    const [r,c]=m.from;
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) { const q=game.at(r+dr,c+dc); if(q && q.c==='w' && q.t!=='K') { const f=document.createElement('span'); f.textContent='🐟'; fishes.append(f); } }
    stage.append(fishes); const rod=document.createElement('div'); rod.className='rod'; rod.textContent='🎣'; stage.append(rod); say('Ам, ам, ам, ам');
  } else stage.classList.add('sigma');
  await pause(1800); stage.classList.remove('sigma'); stage.hidden=true;
}
$('btn-ult').onclick=async()=>{
  if(busy || game.result) return;
  targets=game.ultimateMoves(); if(!targets.length) return;
  selected=game.kingPos(game.turn); ultMode=true;
  if(game.turn==='b') await tryMove(...selected);
  else { paintHighlights(); $('status').textContent='Выберите фигуру для обмена с Соколовым'; }
};
function startIntro() {
  busy=true; $('btn-new').disabled=true; $('btn-undo').disabled=true;
  boardEl.classList.add('intro-board'); boardEl.replaceChildren();
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
    const cell=document.createElement('div'); cell.className='cell '+((r+c)%2?'dark':'light');
    if(c===4 && (r===0 || r===7)) cell.append(pieceEl({t:'K',c:r===0?'b':'w'})); boardEl.append(cell);
  }
  $('duel').showModal();
}
async function duel() {
  $('duel').close(); game.limit=+$('limit').value;
  boardEl.classList.add('dueling'); say('Дуэль!');
  const pistols=document.createElement('div'); pistols.className='pistols'; pistols.textContent='🔫'; boardEl.append(pistols);
  const beam=document.createElement('div'); beam.className='laser'; boardEl.append(beam);
  for(let i=0;i<12;i++){ Sound.play('move'); await pause(500); }
  boardEl.classList.remove('dueling'); beam.remove(); pistols.remove();
  $('scene').replaceChildren(); const phrase=document.createElement('h2'); phrase.textContent='Ладно, давай решим по-мужски'; $('scene').append(phrase,face('wK'),face('bK')); $('scene').hidden=false; say(phrase.textContent);
  await pause(2200); $('scene').hidden=true; boardEl.classList.remove('intro-board'); busy=false;
  $('btn-new').disabled=false; $('btn-undo').disabled=false; render(); boardEl.classList.add('dropping'); setTimeout(()=>boardEl.classList.remove('dropping'),900);
}
$('duel-gas').onclick=duel; $('duel-go').onclick=duel;
$('duel').oncancel=e=>e.preventDefault();
startIntro();
