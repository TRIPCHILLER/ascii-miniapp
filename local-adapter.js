(function () {
  'use strict';

  window.ASCII_VISOR_LOCAL = true;

  if (!window.asciiVisorDesktop) return;

  window.asciiVisorDesktop.getRuntimeInfo()
    .then((runtimeInfo) => {
      window.ASCII_VISOR_RUNTIME = runtimeInfo;
      window.dispatchEvent(new CustomEvent('ascii-visor-runtime-ready', { detail: runtimeInfo }));
    })
    .catch((error) => {
      console.error('[ASCII VISOR] Failed to read desktop runtime info', error);
    });
}());
