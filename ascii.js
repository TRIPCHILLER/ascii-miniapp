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
    this._ctx = this._c.getContext('2d',{ willReadFrequently:true });
    this._video = null; this._stream = null; this._raf = 0; this._timer = 0;
  }

  setOptions(o){
    Object.assign(this.opts,o);
    this.out.style.color = this.opts.color;
    document.body.style.background = this.opts.background;
  }

  async start(){
    if (this._stream) return; // уже запущено
    const constraints = { video: { facingMode: this.facing }, audio:false };
    this._stream = await navigator.mediaDevices.getUserMedia(constraints);
    this._video = document.createElement('video');
    this._video.srcObject = this._stream;
    await this._video.play();
    this._loop();
  }

  stop(){
    cancelAnimationFrame(this._raf);
    clearTimeout(this._timer);
    if (this._stream){ this._stream.getTracks().forEach(t=>t.stop()); this._stream=null; }
  }

  flip(){
    this.facing = (this.facing==='user'?'environment':'user');
    this.stop();
    this.start();
  }

  _loop = ()=>{
    const v = this._video;
    if (!v || v.readyState < 2){ this._raf = requestAnimationFrame(this._loop); return; }

    const w = this.opts.widthChars;
    // ✅ правильное соотношение сторон без костылей
    const aspect = v.videoHeight / v.videoWidth;
    const h = Math.max(1, Math.round(w * aspect));
    this._c.width = w; this._c.height = h;

    this._ctx.drawImage(v,0,0,w,h);
    const data = this._ctx.getImageData(0,0,w,h).data;
    const rlen = this.opts.ramp.length-1;
    const inv = this.opts.invert;

    let s = '';
    for (let y=0; y<h; y++){
      let row = '';
      for (let x=0; x<w; x++){
        const i = (y*w + x)*4;
        let L = 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2];
        L = (L-128)*this.opts.contrast + 128;
        L = 255 * Math.pow(Math.min(255,Math.max(0,L))/255, 1/this.opts.gamma);
        const idx = Math.round((inv ? L : (255-L))/255 * rlen);
        row += this.opts.ramp[idx];
      }
      s += row+'\n';
    }
    this.out.textContent = s;

    const interval = 1000/this.opts.fps;
    this._timer = setTimeout(()=>{ this._raf = requestAnimationFrame(this._loop); }, interval);
  }
}

// 🔹 мобильный fullscreen (убираем меню, показываем кнопку назад)
export function enableMobileFullscreen(button, toolbar, outWrap){
  if (!button) return;
  button.addEventListener('click', ()=>{
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      // Телефон: прячем тулбар
      toolbar.style.display = 'none';
      const exitBtn = document.createElement('button');
      exitBtn.textContent = '⤺';
      exitBtn.className = 'btn ghost';
      exitBtn.style.position='fixed'; exitBtn.style.top='8px'; exitBtn.style.right='8px'; exitBtn.style.zIndex='1000';
      document.body.appendChild(exitBtn);
      exitBtn.onclick = ()=>{ toolbar.style.display='flex'; exitBtn.remove(); };
    } else {
      // ПК: обычный fullscreen API
      document.documentElement.requestFullscreen?.();
    }
  });
}
