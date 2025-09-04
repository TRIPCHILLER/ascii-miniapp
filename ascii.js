// ASCII Engine with responsive scaling and fullscreen toggle
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
    this._video = document.createElement('video');
    this._video.playsInline = true; this._video.muted = true; this._video.autoplay = true;
    this._stream = null; this._raf = 0; this._timer = 0;
    this._resizeObs = null;
  }

  setOptions(o){
    Object.assign(this.opts,o||{});
    this.out.style.color = this.opts.color;
    document.body.style.background = this.opts.background;
  }

  async start(){
    if (this._stream) return;
    const constraints = { video: { facingMode: this.facing }, audio:false };
    this._stream = await navigator.mediaDevices.getUserMedia(constraints);
    this._video.srcObject = this._stream;
    try { await this._video.play(); } catch(_) {}
    const container = this.out.parentElement || document.body;
    if (!this._resizeObs) {
      this._resizeObs = new ResizeObserver(() => this._fitFont());
      this._resizeObs.observe(container);
    }
    this._loop();
  }
  stop(){
    cancelAnimationFrame(this._raf);
    clearTimeout(this._timer);
    if (this._stream){ this._stream.getTracks().forEach(t=>t.stop()); this._stream=null; }
    if (this._resizeObs){ this._resizeObs.disconnect(); this._resizeObs=null; }
  }
  flip(){
    this.facing = (this.facing==='user'?'environment':'user');
    this.stop();
    return this.start();
  }
  _calcGrid(){
    const v=this._video;
    const W=this.opts.widthChars|0;
    const aspect=(v&&v.videoWidth)?(v.videoHeight/v.videoWidth):(9/16);
    const H=Math.max(1,Math.round(W*aspect));
    return {W,H};
  }
  _fitFont(){
    const container=this.out.parentElement||document.body;
    const rect=container.getBoundingClientRect();
    const {W,H}=this._calcGrid();
    if (!W||!H) return;
    const fw=rect.width/W, fh=rect.height/H;
    const f=Math.max(8,Math.floor(Math.min(fw,fh)));
    this.out.style.fontSize=f+'px';
    this.out.style.lineHeight='1em';
  }
  _loop=()=>{
    const v=this._video;
    if (!v||v.readyState<2){ this._raf=requestAnimationFrame(this._loop); return; }
    const {W,H}=this._calcGrid();
    this._c.width=W; this._c.height=H;
    this._ctx.save();
    if (this.facing==='user'){ this._ctx.translate(W,0); this._ctx.scale(-1,1); }
    this._ctx.drawImage(v,0,0,W,H);
    this._ctx.restore();
    const data=this._ctx.getImageData(0,0,W,H).data;
    const rlen=this.opts.ramp.length-1, inv=!!this.opts.invert;
    let s='';
    for(let y=0;y<H;y++){
      let row='';
      for(let x=0;x<W;x++){
        const i=(y*W+x)*4;
        let L=0.2126*data[i]+0.7152*data[i+1]+0.0722*data[i+2];
        L=(L-128)*this.opts.contrast+128;
        L=255*Math.pow(Math.min(255,Math.max(0,L))/255,1/this.opts.gamma);
        const idx=Math.round((inv?L:(255-L))/255*rlen);
        row+=this.opts.ramp[idx];
      }
      s+=row+'\n';
    }
    this.out.textContent=s;
    this._fitFont();
    const interval=1000/Math.max(1,this.opts.fps|0);
    this._timer=setTimeout(()=>{ this._raf=requestAnimationFrame(this._loop); },interval);
  }
}

export function toggleFullscreenDesktop(){
  if(document.fullscreenElement) return document.exitFullscreen?.();
  else return document.documentElement.requestFullscreen?.();
}
export function toggleMobileFullscreen(toolbar){
  const hidden=toolbar.dataset.hidden==='1';
  if(hidden){
    toolbar.style.display='flex'; toolbar.dataset.hidden='0';
    const exit=document.getElementById('__fs_exit'); if(exit) exit.remove();
  } else {
    toolbar.style.display='none'; toolbar.dataset.hidden='1';
    const exitBtn=document.createElement('button');
    exitBtn.id='__fs_exit'; exitBtn.textContent='⤺'; exitBtn.className='btn ghost';
    Object.assign(exitBtn.style,{position:'fixed',top:'8px',right:'8px',zIndex:'1000'});
    document.body.appendChild(exitBtn);
    exitBtn.onclick=()=>toggleMobileFullscreen(toolbar);
  }
}
export function wireFullscreen(btn,toolbar){
  if(!btn) return;
  btn.addEventListener('click',()=>{
    const isMobile=/Mobi|Android/i.test(navigator.userAgent);
    if(isMobile) toggleMobileFullscreen(toolbar);
    else toggleFullscreenDesktop();
  });
}
