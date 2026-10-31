// Смешные анимации. Всё через Web Animations API, на правила не влияет.
'use strict';

const FX = (() => {
  const cellEl = (r, c) => document.querySelector(`#board .cell[data-r="${r}"][data-c="${c}"]`);
  const pieceAt = (r, c) => cellEl(r, c)?.querySelector('.piece');
  const rand = (a, b) => a + Math.random() * (b - a);

  // Снимок до хода: где стояли фигуры, чтобы потом «долететь» оттуда
  function snapshot(m) {
    const take = (r, c) => { const el = pieceAt(r, c); return el && { rect: el.getBoundingClientRect(), html: el.outerHTML }; };
    const victim = m.enPassant ? [m.from[0], m.to[1]] : m.to;
    const s = { mover: take(...m.from), victim: take(...victim) };
    if (m.castle) {
      const row = m.from[0], [rf, rt] = m.castle === 'k' ? [7, 5] : [0, 3];
      s.rook = { ...take(row, rf), to: [row, rt] };
    }
    return s;
  }

  // Прыжок фигуры по дуге с приземлением «в лепёшку»
  function hop(el, fromRect, big) {
    if (!el || !fromRect) return;
    const to = el.getBoundingClientRect();
    const dx = fromRect.left - to.left, dy = fromRect.top - to.top;
    const lift = Math.min(80, 20 + Math.hypot(dx, dy) * .25) * (big ? 1.5 : 1);
    el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(1)` },
      { transform: `translate(${dx / 2}px, ${dy / 2 - lift}px) scale(1.3) rotate(${dx > 0 ? -12 : 12}deg)`, offset: .5 },
      { transform: 'translate(0, 0) scale(1.25, .7)', offset: .85 },
      { transform: 'translate(0, -4px) scale(.9, 1.15)', offset: .93 },
      { transform: 'none' },
    ], { duration: big ? 650 : 420, easing: 'ease-in-out' });
  }

  // Съеденная фигура улетает кувырком за экран
  function yeet(victim, dir) {
    if (!victim) return;
    const ghost = document.createElement('div');
    ghost.innerHTML = victim.html; const g = ghost.firstChild;
    Object.assign(g.style, { position: 'fixed', left: victim.rect.left + 'px', top: victim.rect.top + 'px',
      width: victim.rect.width + 'px', height: victim.rect.height + 'px', zIndex: 50, pointerEvents: 'none' });
    document.body.appendChild(g);
    const side = dir || (Math.random() < .5 ? -1 : 1);
    g.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${side * 30}px, -60px) rotate(${side * 200}deg) scale(1.2)`, offset: .3 },
      { transform: `translate(${side * rand(180, 320)}px, ${innerHeight}px) rotate(${side * 900}deg) scale(.6)`, opacity: .9 },
    ], { duration: 1100, easing: 'cubic-bezier(.3,.1,.6,1)' }).onfinish = () => g.remove();
    burst(victim.rect, ['💥', '⭐', '💫', '✨'], 7);
  }

  // Разлёт эмодзи из точки
  function burst(rect, chars, n = 8, spread = 90) {
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'fx-particle';
      s.textContent = chars[i % chars.length];
      s.style.left = cx + 'px'; s.style.top = cy + 'px';
      document.body.appendChild(s);
      const a = rand(0, Math.PI * 2), d = rand(spread * .4, spread);
      s.animate([
        { transform: 'translate(-50%, -50%) scale(.3)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1.3) rotate(${rand(-180, 180)}deg)`, opacity: 0 },
      ], { duration: rand(600, 1000), easing: 'cubic-bezier(.1,.8,.3,1)' }).onfinish = () => s.remove();
    }
  }

  // Всплывающая надпись над клеткой
  function shout(rect, text, cls = '') {
    const s = document.createElement('div');
    s.className = 'fx-shout ' + cls; s.textContent = text;
    s.style.left = rect.left + rect.width / 2 + 'px'; s.style.top = rect.top + 'px';
    document.body.appendChild(s);
    s.animate([
      { transform: 'translate(-50%, 0) scale(.2) rotate(-20deg)', opacity: 0 },
      { transform: 'translate(-50%, -30px) scale(1.2) rotate(6deg)', opacity: 1, offset: .25 },
      { transform: 'translate(-50%, -40px) scale(1) rotate(-3deg)', opacity: 1, offset: .75 },
      { transform: 'translate(-50%, -70px) scale(.8)', opacity: 0 },
    ], { duration: 1400, easing: 'ease-out' }).onfinish = () => s.remove();
  }

  const wiggle = (el, ms = 500) => el?.animate([
    { transform: 'rotate(0)' }, { transform: 'rotate(-15deg) scale(1.1)' }, { transform: 'rotate(12deg) scale(1.1)' },
    { transform: 'rotate(-8deg)' }, { transform: 'rotate(0)' },
  ], { duration: ms });

  const tremble = (el, times = 6) => el?.animate(
    Array.from({ length: times * 2 + 1 }, (_, i) => ({ transform: i === times * 2 ? 'none' : `translateX(${i % 2 ? -5 : 5}px) rotate(${i % 2 ? -4 : 4}deg)` })),
    { duration: times * 90 });

  // Король падает
  function faint(el) {
    el?.animate([
      { transform: 'none' }, { transform: 'rotate(-15deg)', offset: .3 },
      { transform: 'rotate(10deg)', offset: .5 }, { transform: 'rotate(90deg) translateX(10%)' },
    ], { duration: 1000, delay: 300, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'forwards' });
  }

  function confetti() {
    const box = document.getElementById('board').getBoundingClientRect();
    for (let k = 0; k < 4; k++) setTimeout(() => burst(
      { left: box.left + rand(0, box.width), top: box.top + rand(0, box.height / 2), width: 0, height: 0 },
      ['🎉', '🎊', '👑', '🥳', '✨'], 10, 160), k * 250);
  }

  // Анимация после хода; s — снимок до хода, res — результат game.move
  function afterMove(s, res, game) {
    const m = res.move, landed = pieceAt(...m.to), rect = cellEl(...m.to).getBoundingClientRect();
    hop(landed, s.mover?.rect, !!res.taken);
    if (s.rook) hop(pieceAt(...s.rook.to), s.rook.rect);
    if (res.taken) setTimeout(() => {
      yeet(s.victim, Math.sign(m.to[1] - m.from[1]) || 0);
      wiggle(landed);
      shout(rect, ['Ам!', 'Хрум!', 'Бац!', 'Ням!', 'Пока!', 'Вжух!'][Math.floor(rand(0, 6))]);
    }, 300);
    if (m.castle) setTimeout(() => shout(rect, 'Рокировочка!'), 300);
    if (m.promo) setTimeout(() => { burst(rect, ['✨', '⭐', '🌟'], 12); shout(rect, 'Эволюция!', 'gold'); }, 400);

    const enemyK = game.kingPos(game.turn);
    const kEl = enemyK && pieceAt(...enemyK);
    if(res.event==='zonewin') { shout(rect,'Центр наш!','gold'); confetti(); }
    if (res.event === 'check') setTimeout(() => { tremble(kEl); shout(kEl.getBoundingClientRect(), 'Ой-ой!', 'red'); }, 450);
    if (res.event === 'checkmate') setTimeout(() => { faint(kEl); shout(kEl.getBoundingClientRect(), 'Мат!', 'red'); confetti(); }, 450);
  }

  function select(r, c) {
    pieceAt(r, c)?.animate([
      { transform: 'none' }, { transform: 'translateY(-14%) scale(1.12, .95)', offset: .4 },
      { transform: 'translateY(0) scale(.94, 1.06)', offset: .75 }, { transform: 'none' },
    ], { duration: 320, easing: 'ease-out' });
  }

  function illegal(r, c) {
    const el = r != null ? pieceAt(r, c) : null;
    if (el) el.animate([{ transform: 'none' }, { transform: 'rotate(-10deg)' }, { transform: 'rotate(10deg)' },
      { transform: 'rotate(-10deg)' }, { transform: 'none' }], { duration: 400 });
    else document.getElementById('board').animate([{ transform: 'none' }, { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 300 });
  }

  return { snapshot, afterMove, select, illegal, confetti };
})();
