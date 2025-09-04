// ASCII Engine — safe autoplay + correct aspect + mobile fullscreen helper
export class AsciiApp {
  constructor(outEl){
    this.out = outEl;
    this.opts = {
      widthChars: 140, contrast: 1.15, gamma: 1.2,
      color: '#8ac7ff', background: '#000', fps: 30,
      ramp: " .'`\",:;Il!i~+_-?][}{1tfjrxnuvczXYUJCLQ0089@#", invert: true
    };
    this.facing = 'user';

    this._c = document.createElement('canvas');
    this._ctx = this._c.getContext('2d', { willReadFrequently: true });

    this._video = document.createElement('video');
    this._video.playsInline = true;  // iOS/Android
    this._video.muted = true;        // чтоб play() не блокировался
    this._video.autoplay = true;

    this._stream = null;
    this._raf = 0; this._timer = 0;
    this._boundKick = () => { this._video.play().catch(()=>{}); document.removeEventListener('touchstart', this._boundKick, {passive:true}); document.removeEventListener('click', this._boundKick); };
  }

  setOptions(o){
    Object.assign(this.opts,o||{});
    this.out.style.color = this.opts.color;
    document.body.style.background = this.opts.background;
  }

  async start(){
    if (this._stream) { return; }
    // user gesture helper: если браузер все равно ругается — добьём первым тапом/кликом
    document.addEventListener('touchstart', this._boundKick, {once:true, passive:true});
    document.addEventListener('click', this._boundKick, {once:true});

    const constraints = { audio:false, video:{ facingMode: this.facing } };
    this._stream = await navigator.mediaDevices.getUserMedia(constraints);
    this._video.srcObject = this._stream;

    try { await this._video.play(); } catch (_) { /* добьёмся первым жестом */ }

    this._loop();
  }

  stop(){
    cancelAnimationFrame(this._raf);
    clearTimeout(this._timer);
    if (this._stream){ this._stream.getTracks().forEach(t=>t.stop()); this._stream = null; }
  }

  flip(){
    this.facing = (this.facing === 'user') ? 'environment' : 'user';
    this.stop();
    return this.start();
  }

  _loop = ()=>{
    const v = this._video;
    if (!v || v.readyState < 2){ this._raf = requestAnimationFrame(this._loop); return; }

    const W = this.opts.widthChars;
    const aspect = v.videoHeight / v.videoWidth;  // ✅ без костылей — реальная пропорция
    const H = Math.max(1, Math.round(W * aspect));

    this._c.width = W; this._c.height = H;
    this._ctx.save();
    if (this.facing === 'user') { // естественное селфи
      this._ctx.translate(W, 0);
      this._ctx.scale(-1, 1);
    }
    this._ctx.drawImage(v, 0, 0, W, H);
    this._ctx.restore();

    const data = this._ctx.getImageData(0,0,W,H).data;
    const rlen = this.opts.ramp.length - 1;
    const inv = !!this.opts.invert;

    let s = '';
    for (let y=0; y<H; y++){
      let row = '';
      for (let x=0; x<W; x++){
        const i = (y*W + x)*4;
        let L = 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2];
        L = (L-128)*this.opts.contrast + 128;
        L = 255 * Math.pow(Math.min(255,Math.max(0,L))/255, 1/this.opts.gamma);
        const idx = Math.round((inv ? L : (255-L)) / 255 * rlen);
        row += this.opts.ramp[idx];
      }
      s += row + '\n';
    }
    this.out.textContent = s;

    const interval = 1000/Math.max(1, this.opts.fps|0);
    this._timer = setTimeout(()=>{ this._raf = requestAnimationFrame(this._loop); }, interval);
  }
}

// Mobile fullscreen: скрываем тулбар, показываем крошечную кнопку «назад»
export function enableMobileFullscreen(button, toolbar){
  if (!button) return;
  button.addEventListener('click', ()=>{
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) {
      toolbar.style.display = 'none';
      const exitBtn = document.createElement('button');
      exitBtn.textContent = '⤺';
      exitBtn.className = 'btn ghost';
      Object.assign(exitBtn.style,{position:'fixed',top:'8px',right:'8px',zIndex:'1000'});
      document.body.appendChild(exitBtn);
      exitBtn.onclick = ()=>{ toolbar.style.display='flex'; exitBtn.remove(); };
    } else {
      document.documentElement.requestFullscreen?.();
    }
  });
}
