// ascii.js — ES module (shared between index.html and pro.html)

// ============== DETECT ==============
export const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

// ============== SHARED CHARSETS (ordered light → dark) ==============
export const CHARSETS = {
  classic:  " .'`\",:;Il!i~+_-?][}{1tfjrxnuvczXYUJCLQ0089@#",
  digits:   " 0123456789#@",
  letters:  " ABCDEFGHIJKLMNOPQRSTUVWXYZ@",
  allLetters: " aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ@",
  katakana: " ･｡･・· アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン█",
  hiragana: " ･｡･・· あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん█",
  dots:     "  .'`^,:;-_~#@",
  blocks:   " ░▒▓█"
};

// ============== FULLSCREEN HELPER ==============
export function wireFullscreen(btn, rootToFullscreen){
  if (!btn || !rootToFullscreen) return;
  let exitBtn = null;

  const inFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  async function requestFull(){
    try {
      if (rootToFullscreen.requestFullscreen) await rootToFullscreen.requestFullscreen();
      else if (rootToFullscreen.webkitRequestFullscreen) await rootToFullscreen.webkitRequestFullscreen();
    } catch(e){ /* ignore */ }
  }
  async function enter(){
    await requestFull();
    if (isMobile && screen.orientation?.lock){
      try { await screen.orientation.lock('landscape'); } catch(e){ /* ignore */ }
    }
    if (!exitBtn){
      exitBtn = document.createElement('button');
      exitBtn.className = 'fs-exit';
      exitBtn.type = 'button';
      exitBtn.addEventListener('click', exit);
      document.body.appendChild(exitBtn);
    }
  }
  async function exit(){
    try {
      if (inFS()){
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    } catch(e){}
    if (screen.orientation?.unlock){
      try { screen.orientation.unlock(); } catch(e){}
    }
    if (exitBtn){ exitBtn.remove(); exitBtn = null; }
  }

  btn.addEventListener('click', () => inFS() ? exit() : enter());
  document.addEventListener('fullscreenchange', () => {
    if (!inFS() && exitBtn){ exitBtn.remove(); exitBtn = null; }
  });
}

// ============== ASCII RENDER APP ==============
export class AsciiApp {
  constructor(outEl, options = {}){
    if (!outEl) throw new Error('AsciiApp: outEl is required');
    this.out = outEl;
    this.stage = this._findStage(outEl);
    this.state = {
      facing: 'user',          // for mobiles
      mirror: true,            // true ⇒ draw mirrored to cancel selfie mirroring (non-mirrored view)
      widthChars: 160,
      contrast: 1.15,
      gamma: 1.20,
      fps: 30,
      color: '#8ac7ff',
      background: '#000000',
      ramp: CHARSETS.classic,
      invert: true
    };
    Object.assign(this.state, options);

    // styles
    this.out.style.color = this.state.color;
    this.out.style.backgroundColor = this.state.background;
    if (this.stage) this.stage.style.backgroundColor = this.state.background;

    // offscreen + measure
    this.off = document.createElement('canvas');
    this.ctx = this.off.getContext('2d', { willReadFrequently: true });
    this.measurePre = document.createElement('pre');
    this.measurePre.style.cssText = `position:absolute;left:-99999px;top:-99999px;margin:0;white-space:pre;line-height:1ch;font-family:ui-monospace,Menlo,Consolas,"Cascadia Mono",monospace;`;
    document.body.appendChild(this.measurePre);

    // hidden video
    this.vid = document.createElement('video');
    this.vid.setAttribute('playsinline','');
    this.vid.muted = true;
    this.vid.autoplay = true;
    this.vid.hidden = true;
    document.body.appendChild(this.vid);

    // loop/fps
    this._raf = null;
    this._lastTs = 0;

    // resize hook
    if (this.stage) {
      this._ro = new ResizeObserver(() => {
        const { w, h } = this._updateGridSize();
        this._refitFont(w, h);
      });
      this._ro.observe(this.stage);
    }
  }

  _findStage(el){
    let cur = el;
    while (cur && cur !== document.body){
      if (cur.classList?.contains('stage')) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  setOptions(opts = {}){
    Object.assign(this.state, opts);
    if (opts.color) this.out.style.color = this.state.color;
    if (opts.background){
      this.out.style.backgroundColor = this.state.background;
      if (this.stage) this.stage.style.backgroundColor = this.state.background;
    }
  }

  async _startStream(){
    // stop previous
    if (this.vid.srcObject){
      try { this.vid.srcObject.getTracks().forEach(t=>t.stop()); } catch(e){}
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.state.facing } });
    this.vid.srcObject = stream;
    await this.vid.play();
  }

  async start(){
    await this._startStream();
    if (this._raf) cancelAnimationFrame(this._raf);
    const { w, h } = this._updateGridSize();
    this._refitFont(w, h);
    const loop = (ts) => {
      this._raf = requestAnimationFrame(loop);
      const frameInt = 1000 / this.state.fps;
      if (ts - this._lastTs < frameInt) return;
      this._lastTs = ts;
      if (!this.vid.videoWidth || !this.vid.videoHeight) return;
      const { w, h } = this._updateGridSize();
      const ctx = this.ctx;

      // mirror transform
      ctx.setTransform(this.state.mirror ? -1 : 1, 0, 0, 1, this.state.mirror ? this.off.width : 0, 0);
      ctx.drawImage(this.vid, 0, 0, this.off.width, this.off.height);
      ctx.setTransform(1,0,0,1,0,0);

      const data = ctx.getImageData(0, 0, this.off.width, this.off.height).data;
      const chars = this.state.ramp;
      const n = chars.length - 1;
      if (n <= 0) return;

      const contrast = this.state.contrast;
      const gamma = this.state.gamma;
      const invert = !!this.state.invert;

      let out = '';
      let i = 0;
      for (let y = 0; y < this.off.height; y++){
        let line = '';
        for (let x = 0; x < this.off.width; x++, i+=4){
          const r = data[i], g = data[i+1], b = data[i+2];
          // luminance
          let v = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
          // contrast (around 0.5), clamp
          v = ((v - 0.5) * contrast) + 0.5;
          v = v < 0 ? 0 : (v > 1 ? 1 : v);
          // gamma
          v = Math.pow(v, 1 / gamma);
          // invert → choose index
          const idx = Math.round((invert ? (1 - v) : v) * n);
          line += chars[idx];
        }
        out += line + '\n';
      }
      this.out.textContent = out;
      this._refitFont(this.off.width, this.off.height);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop(){
    if (this._raf){ cancelAnimationFrame(this._raf); this._raf = null; }
    if (this.vid?.srcObject){
      try { this.vid.srcObject.getTracks().forEach(t=>t.stop()); } catch(e){}
    }
  }

  async flip(){
    if (isMobile){
      this.state.facing = this.state.facing === 'user' ? 'environment' : 'user';
      await this._startStream();
      // keep non-mirrored (mirror=true means draw flipped to cancel selfie mirror)
      this.state.mirror = true;
    } else {
      this.state.mirror = !this.state.mirror;
    }
  }

  destroy(){
    this.stop();
    this.measurePre?.remove();
    this.vid?.remove();
    if (this._ro && this.stage) this._ro.unobserve(this.stage);
  }

  _measureCharAspect(){
    // returns width/height of a mono "cell"
    this.measurePre.textContent = 'M\nM';
    this.measurePre.style.fontSize = getComputedStyle(this.out).fontSize || '16px';
    const rect = this.measurePre.getBoundingClientRect();
    const lineH = rect.height / 2;
    const chW = rect.width / 1;
    const charRatio = lineH / chW; // H/W
    return 1 / charRatio;          // W/H
  }

  _updateGridSize(){
    if (!this.vid.videoWidth || !this.vid.videoHeight){
      this.off.width = this.state.widthChars;
      this.off.height = 1;
      return { w: this.off.width, h: this.off.height };
    }
    const ratio = this._measureCharAspect();
    const aspect = (this.vid.videoHeight / this.vid.videoWidth) / ratio;
    const w = Math.max(1, Math.round(this.state.widthChars));
    const h = Math.max(1, Math.round(w * aspect));
    this.off.width = w;
    this.off.height = h;
    return { w, h };
  }

  _refitFont(cols, rows){
    if (!this.stage) return;
    const stageW = this.stage.clientWidth || window.innerWidth;
    const stageH = this.stage.clientHeight || window.innerHeight;

    // initial measure
    this.measurePre.textContent = ('M'.repeat(cols) + '\n').repeat(rows);
    const currentFS = parseFloat(getComputedStyle(this.out).fontSize) || 16;
    this.measurePre.style.fontSize = currentFS + 'px';
    let r = this.measurePre.getBoundingClientRect();
    const k1 = Math.min(stageW / r.width, stageH / r.height);
    let newFS = Math.max(6, Math.floor(currentFS * k1));

    // second pass
    this.measurePre.style.fontSize = newFS + 'px';
    r = this.measurePre.getBoundingClientRect();
    const k2 = Math.min(stageW / r.width, stageH / r.height);
    const finalFS = Math.max(6, Math.floor(newFS * k2));
    this.out.style.fontSize = finalFS + 'px';
  }
}
