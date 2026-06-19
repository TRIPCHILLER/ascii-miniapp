// local-adapter.js
// Локальная заглушка Telegram WebApp API для ASCII VISOR LOCAL.
// Нужна, чтобы старый ascii.js не падал вне Telegram.

(function () {
  const noop = function () {};

  const mockButton = {
    show: noop,
    hide: noop,
    enable: noop,
    disable: noop,
    setText: noop,
    onClick: noop,
    offClick: noop,
    showProgress: noop,
    hideProgress: noop,
    setParams: noop,
  };

  const mockWebApp = {
    initData: "",
    initDataUnsafe: {
      user: {
        id: "local-user",
        first_name: "LOCAL",
        username: "tripchiller_local",
      },
    },

    platform: "desktop",
    version: "local",
    colorScheme: "dark",
    themeParams: {},
    isExpanded: true,
    viewportHeight: window.innerHeight,
    viewportStableHeight: window.innerHeight,

    ready: noop,
    expand: noop,
    close: noop,
    sendData: noop,

    openLink: function (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    },

    HapticFeedback: {
      impactOccurred: noop,
      notificationOccurred: noop,
      selectionChanged: noop,
    },

    MainButton: mockButton,
    BackButton: mockButton,
  };

  window.Telegram = window.Telegram || {};
  window.Telegram.WebApp = window.Telegram.WebApp || mockWebApp;

  window.ASCII_VISOR_LOCAL = true;

  console.log("[ASCII VISOR LOCAL] Telegram WebApp API mocked.");
})();