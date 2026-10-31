// Встроенные SVG-фигуры (используются, если в theme.js не задана картинка).
// Шрифтовые символы ♚♛ на части Android не отображаются, поэтому рисуем сами.
'use strict';

const PIECE_SVG = (() => {
  const base = '<rect x="9" y="36" width="27" height="5" rx="2"/>';
  const shapes = {
    P: base + '<path d="M15 36 Q15 29 19 26 Q16 23 17.5 19.5 Q19 16 22.5 16 Q26 16 27.5 19.5 Q29 23 26 26 Q30 29 30 36 Z"/><circle cx="22.5" cy="12" r="5"/>',
    R: base + '<path d="M13 36 L14.5 17 L30.5 17 L32 36 Z"/><path d="M11 9 H16 V12.5 H19.5 V9 H25.5 V12.5 H29 V9 H34 V17 H11 Z"/>',
    B: base + '<path d="M15 36 Q12 27 17 19 Q20 14 22.5 11 Q25 14 28 19 Q33 27 30 36 Z"/><circle cx="22.5" cy="7.5" r="3"/><path d="M22.5 18 V27 M18 22.5 H27" fill="none" stroke-width="2"/>',
    N: base + '<path d="M14 36 C14 29 17 25 21 21.5 C17 22.5 14 23.5 11 21.5 C9.5 19.5 11 17 13 15 C16 11 19 9 21 7 L22 3.5 L25 7.5 C32 10 35 20 33 36 Z"/><circle cx="20" cy="12.5" r="1.6" class="eye"/>',
    Q: base + '<path d="M12.5 36 L9.5 15 L17 27 L22.5 11 L28 27 L35.5 15 L32.5 36 Z"/><circle cx="9.5" cy="13" r="2.8"/><circle cx="22.5" cy="9" r="2.8"/><circle cx="35.5" cy="13" r="2.8"/><circle cx="16" cy="18" r="2.2"/><circle cx="29" cy="18" r="2.2"/>',
    K: base + '<path d="M13.5 36 Q11 24 17 20 Q22.5 17 28 20 Q34 24 31.5 36 Z"/><path d="M21 4 H24 V8 H28 V11 H24 V18 H21 V11 H17 V8 H21 Z"/>',
  };
  const look = {
    w: { fill: '#f7f2e6', stroke: '#2a2622', eye: '#2a2622' },
    b: { fill: '#2c2b31', stroke: '#e9e3d6', eye: '#e9e3d6' },
  };
  const cache = {};
  return (t, c) => {
    const k = c + t;
    if (!cache[k]) {
      const l = look[c];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><style>.eye{fill:${l.eye};stroke:none}</style>`
        + `<g fill="${l.fill}" stroke="${l.stroke}" stroke-width="1.5" stroke-linejoin="round">${shapes[t]}</g></svg>`;
      cache[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
    return cache[k];
  };
})();
