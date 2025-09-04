// Работает в index.html и pro.html
(function () {
  function byId(id){ return document.getElementById(id); }

  function enableModal() {
    const consent = byId('consent');
    if (!consent) return;
    document.body.classList.add('has-modal');
    consent.hidden = false;
  }

  function disableModal() {
    const consent = byId('consent');
    if (!consent) return;
    consent.hidden = true;
    document.body.classList.remove('has-modal');
  }

  function alreadyConsented() {
    try { return localStorage.getItem('consent-ok') === '1'; } catch (e) { return false; }
  }

  function setConsented() {
    try { localStorage.setItem('consent-ok','1'); } catch (e) {}
  }

  function setupIndex() {
    const startBtn = byId('start');
    const agree = byId('agree');
    if (!startBtn || !agree) return;

    if (!alreadyConsented()) enableModal();

    agree.addEventListener('click', () => {
      setConsented();
      disableModal();
      // Старт камеры в рамках пользовательского жеста
      startBtn.click();
    });
  }

  function setupPro() {
    // На pro.html камеры нет кнопки Start — стартуем сразу после согласия
    const agree = byId('agree');
    if (!agree) return;

    // Если уже согласились ранее — модалку не показываем
    if (alreadyConsented()) {
      const consent = byId('consent');
      if (consent) consent.hidden = true;
      document.body.classList.remove('has-modal');
      document.dispatchEvent(new CustomEvent('consent-ready'));
      return;
    }

    enableModal();

    agree.addEventListener('click', () => {
      setConsented();
      disableModal();
      document.dispatchEvent(new CustomEvent('consent-ready'));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Определим страницу по наличию кнопок/элементов
    if (byId('start')) setupIndex(); else setupPro();
  });
})();
