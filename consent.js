<!-- consent.js -->
<script>
(function () {
  function byId(id){ return document.getElementById(id); }

  function alreadyConsented() {
    try { return localStorage.getItem('consent-ok') === '1'; } catch (e) { return false; }
  }
  function setConsented() {
    try { localStorage.setItem('consent-ok','1'); } catch (e) {}
  }

  function showModal() {
    const modal = byId('consent');
    if (!modal) return;
    modal.hidden = false;
    // Если где-то ещё используешь этот класс — оставим, но он больше не обязателен
    document.body.classList.add('has-modal');
  }
  function hideModal() {
    const modal = byId('consent');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('has-modal');
  }

  function dispatchReady() {
    // Новый путь: страницы слушают это событие и сами стартуют камеру
    document.dispatchEvent(new Event('consent-ready'));
    // Старый путь (обратная совместимость): если есть кнопка #start — нажмём
    const startBtn = byId('start');
    if (startBtn) { try { startBtn.click(); } catch(e){} }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const modal = byId('consent');
    const agree = byId('agree');

    // Если на странице нет модалки — ничего не делаем
    if (!modal || !agree) {
      // но если согласие уже было — всё равно дёрнем готовность,
      // чтобы index.html смог стартовать камеру
      if (alreadyConsented()) dispatchReady();
      return;
    }

    if (alreadyConsented()) {
      hideModal();
      dispatchReady();
      return;
    }

    // Согласия нет — показываем модалку и ждём клика
    showModal();
    agree.addEventListener('click', () => {
      setConsented();
      hideModal();
      dispatchReady();
    }, { once:true });
  });
})();
</script>
