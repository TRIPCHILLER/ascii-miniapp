// ramps.js — единый источник раскладок ASCII
(function () {
  const MAP = {
    classic: " @%#*+=-:.",                 // можешь менять порядок
    digits:  " 00112233445566778899",
    letters: "  iIl1tTjfJrRvxXcCuUnNzZmwWQO",
    dots:    " .'`^,:;-_~",
    blocks:  " ░▒▓█"
  };

  // Глобально: ASCII_RAMPS.get('classic') -> строка символов
  window.ASCII_RAMPS = {
    map: MAP,
    keys() { return Object.keys(MAP); },
    get(name) { return MAP[name] || null; }
  };
})();
