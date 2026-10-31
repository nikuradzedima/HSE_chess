// ===== НАСТРОЙКА ВНЕШНЕГО ВИДА И ОЗВУЧКИ =====
// Картинки фигур: положите файлы в assets/pieces/ и пропишите пути ниже.
//   Ключ — цвет (w/b) + тип: K король, Q ферзь, R ладья, B слон, N конь, P пешка.
//   Если поле пустое или файла нет — рисуется стандартный символ.
// Звуки: положите mp3/ogg/wav в assets/sounds/. Пустое поле — встроенный синтезированный звук.
//   Можно указать массив — будет выбран случайный вариант (разные реплики персонажа).
//   Ключ "<событие>:<фигура>" (например "capture:wN") важнее общего "capture".

window.THEME = {
  title: 'Шахматы проектной школы ИП',
  names: { w: 'Белые', b: 'Чёрные' },

  pieces: {
    wK: 'assets/faces/wK.svg', wQ: 'assets/faces/wQ.svg', wR: 'assets/faces/wR.svg', wB: 'assets/faces/wB.svg', wN: 'assets/faces/wN.svg', wP: '',
    bK: 'assets/faces/bK.svg', bQ: 'assets/faces/bQ.svg', bR: 'assets/faces/bR.svg', bB: 'assets/faces/bB.svg', bN: 'assets/faces/bN.svg', bP: '',
    // пример: wN: 'assets/pieces/white-knight.png',
  },

  sounds: {
    'capture:bN': 'assets/sounds/alexander-capture.mp3',
    'capture:wN': 'assets/sounds/pavel-capture.mp3',
    'capture:wR': 'assets/sounds/nina-capture.mp3',
    'capture:bK': 'assets/sounds/mishan-capture.mp3',
    start:     '',  // новая партия
    select:    '',  // выбрали фигуру
    move:      '',
    capture:   '',  // взятие
    castle:    '',
    promote:   '',  // превращение пешки
    check:     '',
    checkmate: '',
    draw:      '',
    illegal:   '',  // недопустимый ход
    // пример: 'capture:wQ': ['assets/sounds/queen-1.mp3', 'assets/sounds/queen-2.mp3'],
  },

  colors: {
    light: '#ecd9b6',
    dark:  '#a9774f',
  },
};
