'use strict';
// Аниме-комикс: на важных ходах поверх доски выезжает страница из 2–3 кадров
// с героями (CHARACTERS), репликами и звукоподражаниями. Тап — пропустить.

const Comic = (() => {
  let enabled = localStorage.getItem('chess-comic') !== 'off';
  let current = null;
  const pick = a => a && a.length ? a[Math.floor(Math.random() * a.length)] : '';
  const ch = key => (window.CHARACTERS || {})[key] || { name: Chess.PIECES[key[1]].name, title: '' };
  const VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

  function art(key) {
    const c = ch(key), img = new Image();
    img.className = 'cm-art'; img.draggable = false;
    img.src = c.art || THEME.pieces[key] || PIECE_SVG(key[1], key[0]);
    img.onerror = () => { img.onerror = null; img.src = PIECE_SVG(key[1], key[0]); };
    return img;
  }

  const MOOD_MARK = { attack: '💢', shock: '💦', faint: '😵', glow: '✨', smug: '😏', worry: '💦' };

  // panel: {key, line, mood, sfx, bg}
  function panelEl(p) {
    const el = document.createElement('div');
    el.className = `cm-panel bg-${p.bg || 'speed'} mood-${p.mood || ''}`;
    if (p.key) {
      const wrap = document.createElement('div'); wrap.className = 'cm-hero';
      wrap.appendChild(art(p.key));
      if (MOOD_MARK[p.mood]) { const m = document.createElement('span'); m.className = 'cm-mark'; m.textContent = MOOD_MARK[p.mood]; wrap.appendChild(m); }
      el.appendChild(wrap);
      const c = ch(p.key);
      const tag = document.createElement('div'); tag.className = 'cm-name';
      tag.innerHTML = `<b></b><small></small>`;
      tag.querySelector('b').textContent = c.name; tag.querySelector('small').textContent = c.title || '';
      el.appendChild(tag);
    }
    if (p.line) { const b = document.createElement('div'); b.className = 'cm-bubble'; b.textContent = p.line; el.appendChild(b); }
    if (p.sfx) { const s = document.createElement('div'); s.className = 'cm-sfx'; s.textContent = p.sfx; el.appendChild(s); }
    return el;
  }

  // Какие кадры показать для результата хода
  function scene(res, game) {
    const m = res.move, me = res.piece.c, foe = me === 'w' ? 'b' : 'w';
    const moverKey = me + res.piece.t, foeK = foe + 'K';
    const t = res.taken;

    if(res.event==='zonewin') return [{key:moverKey,line:'Центр наш!',bg:'gold'},{sfx:'ПОБЕДА ПО ОЧКАМ',bg:'burst'}];
    if (res.event === 'checkmate') return [
      { key: moverKey, line: pick(ch(moverKey).mate) || 'Мат.', mood: 'smug', bg: 'focus' },
      { key: foeK, line: pick(ch(foeK).mated) || '…', mood: 'faint', bg: 'dots' },
      { sfx: 'МАТ!!', bg: 'burst' },
    ];
    if (m.promo) return [
      { key: me + 'P', line: pick(ch(me + 'P').promote) || 'Превращение!', mood: 'glow', bg: 'gold' },
      { key: me + m.promo, sfx: 'ВЖУУУХ', mood: 'glow', bg: 'gold' },
    ];
    if (res.event === 'check') {
      const p = [];
      if (t) p.push({ key: moverKey, line: pick(ch(moverKey).attack), mood: 'attack', bg: 'speed', sound: 'comicPunch' });
      p.push({ key: moverKey, line: pick(ch(moverKey).check) || 'Шах!', mood: 'smug', bg: 'focus' });
      p.push({ key: foeK, line: pick(ch(foeK).worry) || 'Ой-ой!', mood: 'worry', bg: 'dots', sfx: 'ШАХ!' });
      return p.slice(-3);
    }
    if (m.castle) return [
      { key: me + 'K', line: pick(ch(me + 'K').castle) || 'Рокировка!', mood: 'smug', bg: 'speed' },
      { key: me + 'R', line: pick(ch(me + 'R').castle) || 'Есть!', mood: 'attack', bg: 'speed', sfx: 'ШУХ!' },
    ];
    // Взятие: пешка за пешку — без комикса, чтобы не надоедало
    if (t && (VALUE[t.t] + VALUE[res.piece.t] > 2)) return [
      { key: moverKey, line: pick(ch(moverKey).attack) || 'Получай!', mood: 'attack', bg: 'speed', sound: 'comicPunch' },
      { key: t.c + t.t, line: pick(ch(t.c + t.t).fall) || 'А-а-а!', mood: 'shock', bg: 'dots', sound: 'comicHurt' },
      { sfx: pick(['БАМ!', 'ХРЯСЬ!', 'ДЫЩ!', 'БАБАХ!', 'ТЫДЫЩ!']), bg: 'burst' },
    ];
    return null;
  }

  function show(panels) {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'cm-overlay';
      const page = document.createElement('div');
      page.className = `cm-page n${panels.length}`;
      ov.appendChild(page);
      const hint = document.createElement('div'); hint.className = 'cm-hint'; hint.textContent = 'нажмите, чтобы продолжить';
      ov.appendChild(hint);
      document.body.appendChild(ov);

      const timers = [];
      let done = false;
      const finish = () => {
        if (done) return; done = true; timers.forEach(clearTimeout);
        ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 }).onfinish = () => { ov.remove(); resolve(); };
        current = null;
      };
      current = finish;
      ov.addEventListener('pointerdown', e => { e.preventDefault(); finish(); });

      const STEP = 1000;
      panels.forEach((p, i) => timers.push(setTimeout(() => {
        const el = panelEl(p); page.appendChild(el);
        if (p.sound) Sound.play(p.sound);
        el.animate([{ transform: 'scale(1.35) rotate(-2deg)', opacity: 0, filter: 'brightness(3)' },
                    { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }],
                   { duration: 280, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        // замедленный наезд камеры
        el.querySelector('.cm-hero')?.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }],
          { duration: 2600, easing: 'ease-out', fill: 'forwards' });
        el.querySelector('.cm-bubble')?.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: 350, delay: 250, fill: 'backwards', easing: 'ease-out' });
        el.querySelector('.cm-sfx')?.animate([{ transform: 'scale(3) rotate(-25deg)', opacity: 0 }, { transform: 'scale(1) rotate(-8deg)', opacity: 1 }],
          { duration: 300, delay: p.key ? 350 : 0, fill: 'backwards', easing: 'cubic-bezier(.2,1.6,.4,1)' });
        if (!p.key) page.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-8px,5px)' }, { transform: 'translate(7px,-4px)' }, { transform: 'translate(0,0)' }], { duration: 260, delay: 120 });
      }, 250 + i * STEP)));
      timers.push(setTimeout(finish, 250 + panels.length * STEP + 2200));
    });
  }

  // Возвращает промис, который завершится, когда комикс закрыт (или сразу, если его нет)
  function afterMove(res, game) {
    if (!enabled) return Promise.resolve();
    const s = scene(res, game);
    if (!s) return Promise.resolve();
    return new Promise(r => setTimeout(r, 550)).then(() => show(s));
  }

  return {
    afterMove, show,
    close: () => current && current(),
    get enabled() { return enabled; },
    toggle() { enabled = !enabled; localStorage.setItem('chess-comic', enabled ? 'on' : 'off'); return enabled; },
  };
})();
