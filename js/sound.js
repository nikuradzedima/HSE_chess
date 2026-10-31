// Озвучка: файлы из THEME.sounds, иначе короткие синтезированные звуки.
'use strict';

const Sound = (() => {
  let enabled = localStorage.getItem('chess-sound') !== 'off';
  let ctx = null;
  const cache = {};

  const synth = {
    laser:     [[1500, .025], [900, .025], [400, .06]],
    zonewin:   [[523,.1],[659,.1],[784,.1],[1047,.3]],
    start:     [[523, .08], [659, .08], [784, .15]],
    select:    [[880, .03]],
    move:      [[330, .06]],
    capture:   [[220, .05], [160, .1]],
    castle:    [[392, .06], [330, .08]],
    promote:   [[523, .07], [784, .07], [1047, .15]],
    check:     [[880, .08], [880, .08]],
    checkmate: [[784, .15], [622, .15], [523, .15], [392, .4]],
    draw:      [[440, .2], [440, .3]],
    illegal:   [[120, .12]],
  };

  function unlock() {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if(ctx.state==='suspended') ctx.resume().catch(()=>{});
    } catch { /* Audio is optional. */ }
  }
  function beep(notes) {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    if(ctx.state==='suspended') ctx.resume().catch(()=>{});
    let t = ctx.currentTime;
    for (const [f, d] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d);
      t += d * .9;
    }
  }

  function play(event, pieceKey) {
    if (!enabled) return;
    const s = THEME.sounds;
    let src = (pieceKey && s[`${event}:${pieceKey}`]) || s[event];
    if (Array.isArray(src)) src = src[Math.floor(Math.random() * src.length)];
    if (src) {
      const a = cache[src] = cache[src] || new Audio(src);
      a.volume = event === 'comicPunch' || event === 'comicHurt' ? .55 : 1;
      a.currentTime = 0;
      a.play().catch(() => { if(enabled) beep(synth[event] || synth.move); });
    } else if (synth[event]) beep(synth[event]);
  }

  return {
    play, unlock,
    toggle() { enabled = !enabled; if(!enabled) Object.values(cache).forEach(a=>{a.pause();a.currentTime=0;}); localStorage.setItem('chess-sound', enabled ? 'on' : 'off'); return enabled; },
    get enabled() { return enabled; },
  };
})();
