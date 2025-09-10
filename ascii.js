(() => {
  // ============== УТИЛИТЫ ==============
  const $ = s => document.querySelector(s);
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

  const app = {
    vid:  $('#vid'),
    out:  $('#out'),
    stage:$('#stage'),
    ui: {
      flip:     $('#flip'),
      toggle:   $('#toggle'),
      settings: $('#settings'),
      width:    $('#width'),
      widthVal: $('#width_val'),
      contrast: $('#contrast'),
      contrastVal: $('#contrast_val'),
      gamma:    $('#gamma'),
      gammaVal: $('#gamma_val'),
      fps:      $('#fps'),
      fpsVal:   $('#fps_val'),
      fg:       $('#fg'),
      bg:       $('#bg'),
      charset:  $('#charset'),
      customCharset: $('#charset_custom'),
      invert:   $('#invert'),
      fs:       $('#fs'),
      style:    $('#stylePreset'),
    }
  };

  // Значения по умолчанию
  // ВАЖНО: mirror = true означает "НЕ-зеркальная картинка" (мы инвертируем стандартный селфи-вид).
  // Это даёт "оригинальное" восприятие — стартуем сразу с правильным горизонтальным отражением.
  const state = {
    facing: 'user',         // какая камера для мобилок
    mirror: true,           // режим рисования: true = отразить по X (НЕ-зеркало)
    widthChars: 100,
    contrast: 1.50,
    gamma: 1.20,
    fps: 30,
    color: '#8ac7ff',
    background: '#000000',
    charset: '@%#*+=-:. ',
    invert: true,
    isFullscreen: false,    // наш флаг
  };
  // ===== Стили (палитры) =====
  // Порядок: [тёмный, светлый]; тёмный идёт на ФОН, светлый на ТЕКСТ
  const PRESETS = [
    { id:'oldlcd',     name:'OLD LCD',           colors:['#000000', '#ffffff'] },
    { id:'macintosh',  name:'MACINTOSH',         colors:['#333319', '#e5ffff'] },
    { id:'macpaint',   name:'MAC PAINT',         colors:['#051b2c', '#8bc8fe'] },
    { id:'zenith',     name:'ZENITH ZVM 1240',   colors:['#3f291e', '#fdca55'] },
    { id:'obra',       name:'OBRA DINN',         colors:['#000b40', '#ebe1cd'] },
    { id:'ibm8503',    name:'IBM 8503',          colors:['#2e3037', '#ebe5ce'] },
    { id:'commodore',  name:'COMMODORE 1084',    colors:['#40318e', '#88d7de'] },
    { id:'ibm5151',    name:'IBM 5151',          colors:['#25342f', '#01eb5f'] },
    { id:'matrix',     name:'MATRIX',            colors:['#000000', '#00ff40'] },
    { id:'casio',      name:'CASIO',             colors:['#000000', '#83b07e'] },
    { id:'funkyjam',   name:'FUNKY JAM',         colors:['#920244', '#fec28c'] },
    { id:'cornsole',   name:'CORNSOLE',          colors:['#6495ed', '#fff8dc'] },
    { id:'postapoc',   name:'POSTAPOC SUNSET',   colors:['#1d0f44', '#f44e38'] },
    { id:'laughcry',   name:'POP LAUGH CRY',     colors:['#452f47', '#d7bcad'] },
    { id:'flowers',    name:'FLOWERS AND ASBESTOS', colors:['#c62b69', '#edf4ff'] },
    { id:'pepper1bit', name:'1BIT PEPPER',       colors:['#100101', '#ebb5b5'] },
    { id:'shapebit',   name:'SHAPE BIT',         colors:['#200955', '#ff0055'] },
    { id:'chasing',    name:'CHASING LIGHT',     colors:['#000000', '#ffff02'] },
    { id:'monsterbit', name:'MONSTER BIT',       colors:['#321632', '#cde9cd'] },
    { id:'gatoroboto', name:'GATO ROBOTO',       colors:['#2b0000', '#cc0e13'] },
    { id:'paperback',  name:'PAPERBACK',         colors:['#382b26', '#b8c2b9'] },
  ];
  const CUSTOM_LABEL = 'ПОЛЬЗОВАТЕЛЬСКИЙ';
  const norm = (hex)=> (hex||'').toLowerCase().replace('#','');
  const toHex = v => v && v[0]==='#' ? v : ('#'+v);
  const lum = (hex)=>{ // относительная яркость 0..1
    const h = norm(hex);
    if (h.length<6) return 0;
    const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
    const a=[r,g,b].map(c=> (c<=0.03928)? c/12.92 : Math.pow((c+0.055)/1.055,2.4));
    return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
  };
  // разложить пару на bg/text (тёмный/светлый)
  function splitToBgText(pair){
    const [c1,c2]=pair; return (lum(c1)<=lum(c2))? {bg:c1,text:c2}:{bg:c2,text:c1};
  }
  function detectPreset(textHex, bgHex){
    const t=norm(textHex), b=norm(bgHex);
    for(const p of PRESETS){
      const {bg,text}=splitToBgText(p.colors);
      if(norm(text)===t && norm(bg)===b) return p.id;
    }
    return 'custom';
  }
  function fillStyleSelect(){
    if(!app.ui.style) return;
    app.ui.style.innerHTML='';
    const opt = new Option(CUSTOM_LABEL,'custom'); app.ui.style.append(opt);
    PRESETS.forEach(p=> app.ui.style.append(new Option(p.name,p.id)));
  }
  function applyPreset(id){
    if(!app.ui.style) return;
    if(id==='custom'){ app.ui.style.value='custom'; return; }
    const p = PRESETS.find(x=>x.id===id); if(!p){ app.ui.style.value='custom'; return; }
    const {bg,text}=splitToBgText(p.colors);
    // обновим state и UI как при ручном выборе цвета
    state.color = toHex(text); state.background = toHex(bg);
    app.ui.fg.value = state.color; app.ui.bg.value = state.background;
    app.out.style.color = state.color;
    app.out.style.backgroundColor = state.background;
    app.stage.style.backgroundColor = state.background;
    app.ui.style.value = id;
  }


  // Вспомогательные канвасы
  const off = document.createElement('canvas');
  const ctx = off.getContext('2d', { willReadFrequently: true });

  // Для авто-подгонки шрифта
  const measurePre = document.createElement('pre');
  measurePre.style.cssText = `
    position:absolute; left:-99999px; top:-99999px; margin:0;
    white-space:pre; line-height:1ch; font-family: ui-monospace, Menlo, Consolas, "Cascadia Mono", monospace;
  `;
  document.body.appendChild(measurePre);

  // ============== КАМЕРА ==============
  async function startStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: state.facing }
      });
      app.vid.srcObject = stream;
      await app.vid.play();
      updateMirrorForFacing();
    } catch (e) {
      console.error('getUserMedia error', e);
      alert('Камера недоступна');
    }
  }

  // ============== РЕНДЕРИНГ ==============
  let raf = null;
  let lastFrameTime = 0;

  function setUI() {
    app.ui.width.value = state.widthChars;
    app.ui.widthVal.textContent = state.widthChars;

    app.ui.contrast.value = state.contrast;
    app.ui.contrastVal.textContent = state.contrast.toFixed(2);

    app.ui.gamma.value = state.gamma;
    app.ui.gammaVal.textContent = state.gamma.toFixed(2);

    app.ui.fps.value = state.fps;
    app.ui.fpsVal.textContent = state.fps;

    app.ui.fg.value = state.color;
    app.ui.bg.value = state.background;

    app.ui.charset.value = state.charset;
    app.ui.invert.checked = state.invert;
const lbl = document.getElementById('invert_label');
if (lbl) lbl.textContent = state.invert ? 'ИНВЕРСИЯ: ВКЛ' : 'ИНВЕРСИЯ: ВЫКЛ';

    app.out.style.color = state.color;
    app.out.style.backgroundColor = state.background;
    app.stage.style.backgroundColor = state.background;

    // обновим селект стиля
    fillStyleSelect();
    const matched = detectPreset(state.color, state.background);
    if (app.ui.style) app.ui.style.value = matched === 'custom' ? 'custom' : matched;
  }

  // Пересчёт h и подготовка offscreen размера
  function updateGridSize() {
    const v = app.vid;
    if (!v.videoWidth || !v.videoHeight) return { w: state.widthChars, h: 1 };

    const ratio = measureCharAspect();
    const aspect = (v.videoHeight / v.videoWidth) / ratio;

    const w = Math.max(1, Math.round(state.widthChars));
    const h = Math.max(1, Math.round(w * aspect));

    off.width = w;
    off.height = h;
    return { w, h };
  }

  function measureCharAspect() {
    measurePre.textContent = 'M\nM';
    measurePre.style.fontSize = app.out.style.fontSize || '16px';
    const rect = measurePre.getBoundingClientRect();
    const lineH = rect.height / 2;
    const chW = rect.width / 1;
    const charRatio = lineH / chW; // H/W
    return 1 / charRatio;          // W/H
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);

    // FPS-ограничитель
    const frameInterval = 1000 / state.fps;
    if (ts - lastFrameTime < frameInterval) return;
    lastFrameTime = ts;

    const v = app.vid;
    if (!v.videoWidth || !v.videoHeight) return;

    const { w, h } = updateGridSize();

    // Подготовка трансформа для зеркала
    // mirror = true ⇒ рисуем с scaleX(-1), чтобы получить НЕ-зеркальную картинку
    ctx.setTransform(state.mirror ? -1 : 1, 0, 0, 1, state.mirror ? w : 0, 0);
    ctx.drawImage(v, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const data = ctx.getImageData(0, 0, w, h).data;
// Генерация ASCII (юникод-безопасно + поддержка пустого набора)
const chars = Array.from(state.charset || '');
const n = chars.length - 1;

if (n < 0) {
  // набор пустой → очищаем экран и выходим из функции loop
  app.out.textContent = '';
  refitFont(1, 1);
  return;   // ← важно, именно return из loop!
}

const inv = state.invert ? -1 : 1;
const bias = state.invert ? 255 : 0;
const gamma = state.gamma;
const contrast = state.contrast;

let out = '';
let i = 0;
for (let y = 0; y < h; y++) {
  let line = '';
  for (let x = 0; x < w; x++, i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];

    // яркость → контраст → гамма
    let Y = 0.2126*r + 0.7152*g + 0.0722*b;
    let v01 = Y / 255;
    v01 = ((v01 - 0.5) * contrast) + 0.5;
    v01 = Math.min(1, Math.max(0, v01));
    v01 = Math.pow(v01, 1 / gamma);

    const Yc = Math.max(0, Math.min(255, (bias + inv * (v01 * 255))));
    const idx = Math.round((Yc / 255) * n);
    line += chars[idx];
  }
  out += line + '\n';
}

    app.out.textContent = out;
    refitFont(w, h);
  }

  // Подбор font-size
  let refitLock = false;
  function refitFont(cols, rows) {
    if (refitLock) return;
    refitLock = true;

    const stageW = app.stage.clientWidth;
    const stageH = app.stage.clientHeight;

    measurePre.textContent = ('M'.repeat(cols) + '\n').repeat(rows);
    const currentFS = parseFloat(getComputedStyle(app.out).fontSize) || 16;
    measurePre.style.fontSize = currentFS + 'px';

    let mRect = measurePre.getBoundingClientRect();
    const kW = stageW / mRect.width;
    const kH = stageH / mRect.height;
    const k = Math.min(kW, kH);

    const newFS = Math.max(6, Math.floor(currentFS * k));
    app.out.style.fontSize = newFS + 'px';

    measurePre.style.fontSize = newFS + 'px';
    mRect = measurePre.getBoundingClientRect();
    const k2 = Math.min(stageW / mRect.width, stageH / mRect.height);
    const finalFS = Math.max(6, Math.floor(newFS * k2));
    app.out.style.fontSize = finalFS + 'px';

    refitLock = false;
  }

  // ============== FULLSCREEN (tap-to-exit) ==============
  // Кросс-браузерные хелперы:
  function inNativeFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  async function requestFull() {
    try {
      if (app.stage.requestFullscreen) await app.stage.requestFullscreen();
      else if (app.stage.webkitRequestFullscreen) await app.stage.webkitRequestFullscreen();
      state.isFullscreen = true;
    } catch(e) {
      // игнорируем — пойдём фолбэком
    }
  }

  async function lockLandscapeIfPossible() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      } else {
        // iOS / старые браузеры — фолбэк: дадим хотя бы чистый экран
        document.body.classList.add('body-fullscreen');
      }
    } catch(e) {
      // если запретили — фолбэк
      document.body.classList.add('body-fullscreen');
    }
  }

  // >>> Новая логика: выход по ТАПУ на сцену
  let fsTapHandler = null;
  let fsEnteredAt = 0;

  function enableTapToExit() {
    disableTapToExit(); // защита от дубля

    fsTapHandler = (e) => {
      // защита от случайного мгновенного выхода тем же тапом
      if (Date.now() - fsEnteredAt < 300) return;

      // игнорим явные интерактивные элементы (если будут поверх)
      const t = e.target;
      const tag = (t.tagName || '').toLowerCase();
      if (['button','a','input','select','textarea','label'].includes(tag)) return;

      exitFullscreen();
    };

    app.stage.addEventListener('click', fsTapHandler, { passive: true });
    app.stage.addEventListener('touchend', fsTapHandler, { passive: true });
  }

  function disableTapToExit() {
    if (!fsTapHandler) return;
    app.stage.removeEventListener('click', fsTapHandler);
    app.stage.removeEventListener('touchend', fsTapHandler);
    fsTapHandler = null;
  }

  async function enterFullscreen() {
    fsEnteredAt = Date.now();

    if (isMobile) {
      // мобилки: fullscreen + ландшафт
      await requestFull();
      await lockLandscapeIfPossible();
    } else {
      // десктоп: чистый fullscreen
      await requestFull();
    }

    // включаем выход по тапу
    enableTapToExit();
  }

  async function exitFullscreen() {
    try {
      if (inNativeFullscreen()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    } catch(e) {}
    document.body.classList.remove('body-fullscreen');
    state.isFullscreen = false;

    // снимаем блокировку ориентации, если была
    if (screen.orientation && screen.orientation.unlock) {
      try { screen.orientation.unlock(); } catch(e) {}
    }

    // выключаем обработчик тапа
    disableTapToExit();
  }

  // Системный выход из nat Fullscreen (жест «назад» и т.п.)
  document.addEventListener('fullscreenchange', () => {
    const active = inNativeFullscreen();
    state.isFullscreen = active;
    if (!active) {
      document.body.classList.remove('body-fullscreen');
      disableTapToExit();
    }
  });
function updateMirrorForFacing() {
  // фронталка = зеркалим, тыловая = не зеркалим
  state.mirror = (state.facing === 'user');
}
  // ============== СВЯЗКА UI ==============
  function bindUI() {
    // Показ/скрытие панели
    app.ui.toggle.addEventListener('click', () => {
      const hidden = app.ui.settings.hasAttribute('hidden');
      if (hidden) app.ui.settings.removeAttribute('hidden');
      else app.ui.settings.setAttribute('hidden', '');
      setTimeout(() => {
        const { w, h } = updateGridSize();
        refitFont(w, h);
      }, 0);
    });

    // Кнопка "Фронт/Тыл"
app.ui.flip.addEventListener('click', async () => {
  if (isMobile) {
    state.facing = (state.facing === 'user') ? 'environment' : 'user';
    const s = app.vid.srcObject;
    if (s) s.getTracks().forEach(t => t.stop());
    await startStream(); // внутри вызовется updateMirrorForFacing()
  } else {
    state.mirror = !state.mirror; // на ПК по-прежнему просто зеркалим
  }
});

    // Полноэкранный режим (вход по кнопке, выход — ТОЛЬКО по ТАПУ на сцену)
    if (app.ui.fs) {
      app.ui.fs.addEventListener('click', () => {
        if (!state.isFullscreen) enterFullscreen();
        else exitFullscreen(); // на десктопе оставим тож возможность выходить кнопкой
      });
    }

    app.ui.width.addEventListener('input', e => {
      state.widthChars = +e.target.value;
      app.ui.widthVal.textContent = state.widthChars;
    });

    app.ui.contrast.addEventListener('input', e => {
      state.contrast = +e.target.value;
      app.ui.contrastVal.textContent = state.contrast.toFixed(2);
    });
    app.ui.gamma.addEventListener('input', e => {
      state.gamma = +e.target.value;
      app.ui.gammaVal.textContent = state.gamma.toFixed(2);
    });

    app.ui.fps.addEventListener('input', e => {
      state.fps = +e.target.value;
      app.ui.fpsVal.textContent = state.fps;
    });

    if(app.ui.style){ app.ui.style.addEventListener('change', e => { applyPreset(e.target.value); }); }

    app.ui.fg.addEventListener('input', e => {
      state.color = e.target.value;
      app.out.style.color = state.color;
      if(app.ui.style){ const m = detectPreset(state.color, state.background); app.ui.style.value = (m==='custom'?'custom':m); }
    });
    app.ui.bg.addEventListener('input', e => {
      state.background = e.target.value;
      app.out.style.backgroundColor = state.background;
      app.stage.style.backgroundColor = state.background;
      if(app.ui.style){ const m = detectPreset(state.color, state.background); app.ui.style.value = (m==='custom'?'custom':m); }
    });

app.ui.charset.addEventListener('change', e => {
  if (e.target.value === 'CUSTOM') {
    app.ui.customCharset.style.display = 'inline-block';
    state.charset = app.ui.customCharset.value || '';
  } else {
    app.ui.customCharset.style.display = 'none';
    state.charset = e.target.value;
  }
});

// реагируем на ввод своих символов
app.ui.customCharset.addEventListener('input', e => {
  state.charset = e.target.value || '';
});
// --- Синхронизация видимости при загрузке и первом показе панели ---
function syncCustomField() {
  const isCustom = app.ui.charset.value === 'CUSTOM';
  app.ui.customCharset.style.display = isCustom ? 'inline-block' : 'none';
}
syncCustomField(); // дергаем один раз при биндинге

app.ui.invert.addEventListener('change', e => {
  state.invert = e.target.checked;
  const lbl = document.getElementById('invert_label');
  if (lbl) {
    lbl.textContent = state.invert ? 'ИНВЕРСИЯ: ВКЛ' : 'ИНВЕРСИЯ: ВЫКЛ';
  }
});
    // Подгон при изменении окна/ориентации
    new ResizeObserver(() => {
      const { w, h } = updateGridSize();
      refitFont(w, h);
    }).observe(app.stage);
  }

  // ============== СТАРТ ==============
  async function init() {
    fillStyleSelect();
    setUI();
    bindUI();
    await startStream();

    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);

    const { w, h } = updateGridSize();
    refitFont(w, h);
  }

  document.addEventListener('DOMContentLoaded', init);
})();






