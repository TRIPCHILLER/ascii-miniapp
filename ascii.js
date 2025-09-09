// ascii.js — ES module
// Экспорт: AsciiApp, wireFullscreen, buildRamp
// Также: auto-init если найдены элементы index.html

const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

// ---------- Density calibrator ----------
export async function buildRamp({
  candidates,
  fontFamily,
  fontSize = 16,
  filterWidth = true,
  bg = '#000',
  fg = '#9ec8ff',
}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = fontSize * 2;
  canvas.height = Math.ceil(fontSize * 1.5);

  const widthOf = (ch) => {
    ctx.font = `${fontSize}px ${fontFamily}`;
    return ctx.measureText(ch).width;
  };

  const arr = Array.from(candidates || '');
  if (!arr.length) return '';

  const ref = ['.', '0', 'o', 'O', '#', 'W', 'M'].find(c => arr.includes(c)) || arr[0];
  const refW = widthOf(ref);

  const measured = [];
  for (const ch of arr) {
    if (!ch) continue;
    const w = widthOf(ch);
    if (filterWidth && Math.abs(w - refW) > 0.01) continue;

    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = fg;
    ctx.fillText(ch, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    ctx.restore();

    let sum = 0;
    for (let i = 0; i < img.length; i += 4) {
      const lum = Math.max(img[i], img[i + 1], img[i + 2]);
      if (lum > 10) sum++;
    }
    measured.push({ ch, density: sum, width: w });
  }

  measured.sort((a, b) => a.density - b.density);

  // Удалим слишком близкие по плотности
  const ramp = [];
  let last = -1e9;
  for (const m of measured) {
    if (m.density - last > 20) {
      ramp.push(m.ch);
      last = m.density;
    }
  }
  return ramp.join('');
}

// ---------- presets -> candidates (тематика) ----------
const CANDIDATES = {
  classic: " .'`\",:;Il!i><~+_-?][}{1)(|\\/*tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  numbers: " 1234567890",
  letters_lower: " iljtfrxnuvczsyoeapdhgbqkmw",
  letters_upper: " ILJTFRXNVCAZSEYOAPDHGBQKMW",
  dots_ascii: " .`:-*+ox%#@",
  blocks: " ░▒▓█",
};

// ---------- AsciiApp ----------
export class AsciiApp {
  constructor(outEl) {
    this.out = outEl;
    this.stage = outEl?.closest('#stage') || document.getElementById('stage');
    this.vid = document.getElementById('vid') || document.createElement('video');
    this.off = document.createElement('canvas');
    this.ctx = this.off.getContext('2d', { willReadFrequently: true });

    this.fontFamily = '"Better VCR", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
    this.fontSize = 16;

    this.options = {
      widthChars: 160,
      contrast: 1.15,
      gamma: 1.20,
      color: '#8ac7ff',
      background: '#000000',
      fps: 30,
      ramp: CANDIDATES.classic,
      invert: true,
      mirror: true,     // рисуем scaleX(-1) => «правильная» ориентация
      facing: 'user',   // мобилки: камера
    };

    this._raf = null;
    this._last = 0;

    // вспомогательный <pre> для подгонки к окну
    this.measurePre = document.createElement('pre');
    this.measurePre.style.cssText = `
      position:absolute; left:-99999px; top:-99999px; margin:0;
      white-space:pre; line-height:1ch; font-family:${this.fontFamily};
    `;
    document.body.appendChild(this.measurePre);

    // resize
    if (this.stage) {
      new ResizeObserver(() => {
        const { w, h } = this._updateGridSize();
        this._refitFont(w, h);
      }).observe(this.stage);
    }
  }

  setOptions(opts = {}) {
    Object.assign(this.options, opts);
    if (this.out) {
      this.out.style.color = this.options.color;
      this.out.style.background = this.options.background;
      if (this.stage) this.stage.style.background = this.options.background;
    }
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.options.facing } });
    this.vid.srcObject = stream;
    await this.vid.play();

    // первый рендер
    if (this._raf) cancelAnimationFrame(this._raf);
    const { w, h } = this._updateGridSize();
    this._refitFont(w, h);
    const loop = (ts) => {
      this._raf = requestAnimationFrame(loop);
      const intv = 1000 / this.options.fps;
      if (ts - this._last < intv) return;
      this._last = ts;
      this._render();
    };
    this._raf = requestAnimationFrame(loop);
  }

  flip() {
    if (isMobile) {
      // мобилки: реальный свитч камеры
      this.options.facing = this.options.facing === 'user' ? 'environment' : 'user';
      const s = this.vid.srcObject;
      if (s) s.getTracks().forEach(t => t.stop());
      this.start();
      this.options.mirror = true;
    } else {
      // десктоп: просто зеркалим
      this.options.mirror = !this.options.mirror;
    }
  }

  _measureCharAspect() {
    this.measurePre.textContent = 'M\nM';
    this.measurePre.style.fontSize = (this.out?.style.fontSize || '16px');
    const rect = this.measurePre.getBoundingClientRect();
    const lineH = rect.height / 2;
    const chW = rect.width / 1;
    const charRatio = lineH / chW; // H/W
    return 1 / charRatio;          // W/H
  }

  _updateGridSize() {
    const v = this.vid;
    const wChars = Math.max(1, Math.round(this.options.widthChars));
    if (!v.videoWidth || !v.videoHeight) {
      this.off.width = wChars;
      this.off.height = 1;
      return { w: wChars, h: 1 };
    }
    const ratio = this._measureCharAspect();
    const aspect = (v.videoHeight / v.videoWidth) / ratio;
    const hChars = Math.max(1, Math.round(wChars * aspect));
    this.off.width = wChars;
    this.off.height = hChars;
    return { w: wChars, h: hChars };
  }

  _refitFont(cols, rows) {
    if (!this.stage || !this.out) return;
    const stageW = this.stage.clientWidth;
    const stageH = this.stage.clientHeight;

    this.measurePre.textContent = ('M'.repeat(cols) + '\n').repeat(rows);
    const currentFS = parseFloat(getComputedStyle(this.out).fontSize) || 16;
    this.measurePre.style.fontSize = currentFS + 'px';

    let mRect = this.measurePre.getBoundingClientRect();
    const kW = stageW / mRect.width;
    const kH = stageH / mRect.height;
    const k = Math.min(kW, kH);

    const newFS = Math.max(6, Math.floor(currentFS * k));
    this.out.style.fontSize = newFS + 'px';

    this.measurePre.style.fontSize = newFS + 'px';
    mRect = this.measurePre.getBoundingClientRect();
    const k2 = Math.min(stageW / mRect.width, stageH / mRect.height);
    const finalFS = Math.max(6, Math.floor(newFS * k2));
    this.out.style.fontSize = finalFS + 'px';

    this.fontSize = finalFS;
  }

  _render() {
    const v = this.vid;
    if (!v.videoWidth || !v.videoHeight) return;

    const { w, h } = this._updateGridSize();

    // mirror = true ⇒ рисуем scaleX(-1) (НЕ-зеркальное отображение)
    this.ctx.setTransform(this.options.mirror ? -1 : 1, 0, 0, 1, this.options.mirror ? w : 0, 0);
    this.ctx.drawImage(v, 0, 0, w, h);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    const data = this.ctx.getImageData(0, 0, w, h).data;

    const chars = this.options.ramp;
    const n = chars.length - 1;
    const inv = this.options.invert ? -1 : 1;
    const bias = this.options.invert ? 255 : 0;

    const gamma = this.options.gamma;
    const contrast = this.options.contrast;

    let out = '';
    let i = 0;
    for (let y = 0; y < h; y++) {
      let line = '';
      for (let x = 0; x < w; x++, i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        let Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        let v01 = Y / 255;
        v01 = ((v01 - 0.5) * contrast) + 0.5;
        v01 = Math.min(1, Math.max(0, v01));
        v01 = Math.pow(v01, 1 / gamma);

        const Yc = Math.max(0, Math.min(255, (bias + inv * (v01 * 255))));
        const idx = Math.round((Yc / 255) * n);
        line += chars[idx] || ' ';
      }
      out += line + '\n';
    }
    this.out.textContent = out;
  }
}

// ---------- Fullscreen helper ----------
export function wireFullscreen(buttonEl, toolbarEl) {
  const inNative = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  async function request(el) {
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch {}
  }
  async function exit() {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    } catch {}
  }
  const stage = document.querySelector('.stage');
  buttonEl?.addEventListener('click', async () => {
    if (!inNative()) {
      await request(stage || document.documentElement);
      if (screen.orientation?.lock) { try { await screen.orientation.lock('landscape'); } catch {} }
    } else {
      await exit();
      if (screen.orientation?.unlock) { try { screen.orientation.unlock(); } catch {} }
    }
  });
}

// ---------- AUTO-INIT для index.html ----------
(function autoInitForIndex(){
  const out = document.getElementById('out');
  const stage = document.getElementById('stage');
  const vid = document.getElementById('vid');
  const settings = document.getElementById('settings');
  if (!out || !stage || !vid || !settings) return; // нет верстки index — пропускаем

  const $ = (s) => document.querySelector(s);
  const app = new AsciiApp(out);

  const ui = {
    flip:     $('#flip'),
    toggle:   $('#toggle'),
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
    invert:   $('#invert'),
    fs:       $('#fs'),
    style:    $('#stylePreset'),
    customPanel: $('#asciiCustom'),
    customInput: $('#customChars'),
    applyCustom: $('#applyCustom'),
    resetCustom: $('#resetCustom'),
  };

  // стили палитр (как было)
  const PRESETS = [
    { id:'macintosh',  name:'MACINTOSH',         colors:['#333319', '#e5ffff'] },
    { id:'zenith',     name:'ZENITH ZVM 1240',   colors:['#3f291e', '#fdca55'] },
    { id:'ibm8503',    name:'IBM 8503',          colors:['#2e3037', '#ebe5ce'] },
    { id:'commodore',  name:'COMMODORE 1084',    colors:['#40318e', '#88d7de'] },
    { id:'obra',       name:'OBRA DINN',         colors:['#000b40', '#ebe1cd'] },
    { id:'oldlcd',     name:'OLD LCD',           colors:['#000000', '#ffffff'] },
    { id:'ibm5151',    name:'IBM 5151',          colors:['#25342f', '#01eb5f'] },
    { id:'matrix',     name:'MATRIX',            colors:['#000000', '#00ff40'] },
    { id:'casio',      name:'CASIO BASIC',       colors:['#000000', '#83b07e'] },
    { id:'funkyjam',   name:'FUNKY JAM',         colors:['#920244', '#fec28c'] },
    { id:'cornsole',   name:'CORNSOLE',          colors:['#6495ed', '#fff8dc'] },
    { id:'postapoc',   name:'POSTAPOCALYPTIC SUNSET', colors:['#1d0f44', '#f44e38'] },
    { id:'laughcry',   name:'POP LAUGH CRY',     colors:['#452f47', '#d7bcad'] },
    { id:'flowers',    name:'FLOWERS AND ASBESTOS', colors:['#c62b69', '#edf4ff'] },
    { id:'pepper1bit', name:'1BIT PEPPER',       colors:['#100101', '#ebb5b5'] },
    { id:'shapebit',   name:'SHAPE BIT',         colors:['#200955', '#ff0055'] },
    { id:'sangre',     name:'SANGRE',            colors:['#120628', '#ad1818'] },
    { id:'chasing',    name:'CHASING LIGHT',     colors:['#000000', '#ffff02'] },
    { id:'monsterbit', name:'MONSTER BIT',       colors:['#321632', '#cde9cd'] },
    { id:'gatoroboto', name:'GATO ROBOTO',       colors:['#2b0000', '#cc0e13'] },
    { id:'paperback',  name:'PAPERBACK',         colors:['#382b26', '#b8c2b9'] },
    { id:'macpaint',   name:'MAC PAINT',         colors:['#051b2c', '#8bc8fe'] },
  ];
  const CUSTOM_LABEL = 'пользовательский';
  const norm = (hex)=> (hex||'').toLowerCase().replace('#','');
  const toHex = v => v && v[0]==='#' ? v : ('#'+v);
  const lum = (hex)=>{
    const h = norm(hex); if (h.length<6) return 0;
    const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
    const a=[r,g,b].map(c=> (c<=0.03928)? c/12.92 : Math.pow((c+0.055)/1.055,2.4));
    return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
  };
  const splitToBgText = (pair)=>{ const [c1,c2]=pair; return (lum(c1)<=lum(c2))? {bg:c1,text:c2}:{bg:c2,text:c1}; };

  function fillStyleSelect(){
    if(!ui.style) return;
    ui.style.innerHTML='';
    ui.style.append(new Option(CUSTOM_LABEL,'custom'));
    PRESETS.forEach(p=> ui.style.append(new Option(p.name,p.id)));
  }
  function detectPreset(textHex, bgHex){
    const t=norm(textHex), b=norm(bgHex);
    for(const p of PRESETS){
      const {bg,text}=splitToBgText(p.colors);
      if(norm(text)===t && norm(bg)===b) return p.id;
    }
    return 'custom';
  }
  function applyPreset(id){
    if(id==='custom'||!ui.style) return;
    const p = PRESETS.find(x=>x.id===id); if(!p){ ui.style.value='custom'; return; }
    const {bg,text}=splitToBgText(p.colors);
    app.setOptions({ color:toHex(text), background:toHex(bg) });
    ui.fg.value = toHex(text); ui.bg.value = toHex(bg);
    ui.style.value = id;
  }

  // ---- UI init
  fillStyleSelect();
  ui.width.value = 160; ui.width_val.textContent = 160;
  ui.contrast.value = 1.15; ui.contrast_val.textContent = '1.15';
  ui.gamma.value = 1.20; ui.gamma_val.textContent = '1.20';
  ui.fps.value = 30; ui.fps_val.textContent = 30;
  ui.fg.value = '#8ac7ff'; ui.bg.value = '#000000';
  ui.charset.value = 'classic'; ui.invert.checked = true;

  // ---- helpers
  const LS_KEY_CAND = 'ascii.customCandidates';
  const LS_KEY_RAMP = 'ascii.customRamp';
  try { const saved = localStorage.getItem(LS_KEY_CAND); if (saved) ui.customInput.value = saved; } catch {}

  function normalizeCandidates(raw) {
    const stripped = (raw||'').replace(/\r?\n/g,'');
    const unique = Array.from(new Set(Array.from(stripped)));
    if (!unique.includes(' ')) unique.unshift(' ');
    return unique.filter(ch => ch >= ' ' && ch !== '\t').join('');
  }

  async function rampFor(mode){
    if (mode === 'custom') {
      const cand = normalizeCandidates(ui.customInput.value || '');
      const ramp = await buildRamp({ candidates:cand, fontFamily:app.fontFamily, fontSize:app.fontSize, filterWidth:true });
      try { localStorage.setItem(LS_KEY_CAND, cand); localStorage.setItem(LS_KEY_RAMP, ramp); } catch {}
      return ramp || cand;
    }
    const cand = CANDIDATES[mode] || CANDIDATES.classic;
    const ramp = await buildRamp({ candidates:cand, fontFamily:app.fontFamily, fontSize:app.fontSize, filterWidth:true });
    return ramp || cand;
  }

  async function applyAll() {
    ui.width_val.textContent = ui.width.value;
    ui.contrast_val.textContent = (+ui.contrast.value).toFixed(2);
    ui.gamma_val.textContent = (+ui.gamma.value).toFixed(2);
    ui.fps_val.textContent = ui.fps.value;

    const mode = ui.charset.value;
    ui.customPanel.hidden = mode !== 'custom';

    const ramp = await rampFor(mode);

    app.setOptions({
      widthChars:+ui.width.value,
      contrast:+ui.contrast.value,
      gamma:+ui.gamma.value,
      color:ui.fg.value,
      background:ui.bg.value,
      fps:+ui.fps.value,
      ramp,
      invert:ui.invert.checked
    });
  }

  // ---- bindings
  ui.toggle.addEventListener('click', () => {
    const hidden = settings.hasAttribute('hidden');
    if (hidden) settings.removeAttribute('hidden'); else settings.setAttribute('hidden','');
    setTimeout(app._updateGridSize.bind(app), 0);
  });
  ui.flip.addEventListener('click', () => app.flip());
  ui.fs && wireFullscreen(ui.fs, document.querySelector('.toolbar'));
  ui.style?.addEventListener('change', e => applyPreset(e.target.value));

  ['width','contrast','gamma','fps','fg','bg','charset','invert'].forEach(id=>{
    document.getElementById(id).addEventListener('input', applyAll);
    document.getElementById(id).addEventListener('change', applyAll);
  });

  ui.applyCustom?.addEventListener('click', applyAll);
  ui.resetCustom?.addEventListener('click', () => { try {
      localStorage.removeItem(LS_KEY_CAND); localStorage.removeItem(LS_KEY_RAMP);
    } catch{} ui.customInput.value=''; ui.charset.value='classic'; applyAll();
  });

  // старт
  (async () => {
    await app.start().catch(e => alert('Камера недоступна'));
    // первичная палитра
    const matched = detectPreset('#8ac7ff', '#000000');
    if (ui.style) ui.style.value = matched === 'custom' ? 'custom' : matched;
    await applyAll();
  })();
})();
