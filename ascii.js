/* =========================================================
   ASCII renderer — версия fixA1
   Главное:
   - вписываем ASCII строго в окно .stage (без «уезда»)
   - горизонтальная коррекция: разные коэффициенты для ПК и мобильных
   - цвет фона меняется и вокруг, и под самим ASCII
   - сохраняем твою простую палитру <input type="color">
   ========================================================= */

class AsciiPlayer {
  constructor(opts){
    this.out = opts.out;
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.autoplay   = true;
    this.video.muted      = true;

    // состояние
    this.stream = null;
    this.facing = 'user';

    // параметры
    this.opts = {
      width: opts.width || 160,
      contrast: opts.contrast || 1.15,
      gamma: opts.gamma || 1.20,
      color: opts.color || '#8ac7ff',
      background: opts.background || '#000000',
      fps: opts.fps || 30,
      charset: opts.charset || 'classic',
      invert: !!opts.invert,
    };

    // рабочие элементы
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently:true });

    // буфер символов
    this.chars = this._getCharset(this.opts.charset);

    // коррекция горизонтали:
    // на десктопе немного «растянуть», на мобиле — «сузить»
    this.isMobile = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
    this.scaleX = this.isMobile ? 0.90 : 1.15;

    // применим цвета
    this.setOptions(this.opts);

    // запускаем камеру и цикл рендера
    this._start();
    this._bindResize();
  }

  /* ---------- публичные ---------- */
  setOptions(o){
    Object.assign(this.opts, o || {});
    // цвет текста ASCII
    this.out.style.setProperty('--fg', this.opts.color);

    // фон — и вокруг, и под ASCII (через CSS-переменную)
    document.documentElement.style.setProperty('--bg', this.opts.background);
    this.out.style.background = this.opts.background;

    // при изменениях размеров/настроек — пересоберём кадр
    this._fitFont();
  }

  toggleFacingMode(){
    this.facing = (this.facing === 'user') ? 'environment' : 'user';
    this._start(true);
  }

  /* ---------- приватные ---------- */

  async _start(restart=false){
    try {
      if (restart && this.stream){
        this.stream.getTracks().forEach(t => t.stop());
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facing }
      });
      this.video.srcObject = this.stream;

      this.video.onloadedmetadata = () => {
        this.video.play();
        this._fitFont();
        this._schedule();
      };
    } catch(e){
      console.error('camera error', e);
    }
  }

  _schedule(){
    clearTimeout(this._tid);
    const interval = Math.max(16, 1000/this.opts.fps|0);
    const tick = () => {
      this._render();
      this._tid = setTimeout(tick, interval);
    };
    tick();
  }

  _bindResize(){
    const ro = new ResizeObserver(()=>this._fitFont());
    ro.observe(this.out.parentElement || document.body);
    window.addEventListener('orientationchange', ()=>this._fitFont());
    this._ro = ro;
  }

  _getCharset(kind){
    switch(kind){
      case 'digits':  return ' .,:;+*?%#@0123456789';
      case 'letters': return ' .,:;-_+*=ixvcloOQ0UXJY';
      case 'dots':    return ' .·:•oO@';
      case 'mixed':   return ' `.-_:;=+*ixvcluJYUZCX0Q#%@';
      default:        return ' .`^",:;Il!i~+_-?][}{1)(/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
    }
  }

  _calcGrid(){
    // ширина в символах — как в UI
    const W = Math.max(10, Math.min(1000, this.opts.width|0));

    // соотношение сторон источника
    const vw = this.video.videoWidth  || 640;
    const vh = this.video.videoHeight || 480;
    const srcRatio = vh / vw;

    // оценка «высоты символа к ширине»
    // (после горизонтальной коррекции scaleX)
    // символ «высокий», ширина ~ 0.6em -> после scaleX меняется
    const charWtoH = (0.60 * this.scaleX); // чем больше scaleX, тем «шире» символ
    const H = Math.max(5, Math.round(W * srcRatio / charWtoH));

    return { W, H };
  }

  _fitFont(){
    // контейнер — родитель <pre> = .stage
    const container = this.out.parentElement || document.body;
    const rect = container.getBoundingClientRect();

    // внутренние отступы самого <pre> (рамка/паддинги)
    const cs = getComputedStyle(this.out);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
               + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
               + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);

    const innerW = Math.max(0, rect.width  - padX);
    const innerH = Math.max(0, rect.height - padY);

    const { W, H } = this._calcGrid();
    if (!W || !H || innerW <= 0 || innerH <= 0) return;

    // важный момент: учитываем горизонтальное масштабирование
    // фактическая ширина = (W * fontSize) * scaleX
    const fw = innerW / (W * this.scaleX);
    const fh = innerH /  H;

    // минимальный размер позволяем мелким — для больших ширин
    const f = Math.max(4, Math.floor(Math.min(fw, fh))); // px

    this.out.style.fontSize   = f + 'px';
    this.out.style.lineHeight = '1em';
    this.out.style.transform  = `scaleX(${this.scaleX})`;

    // принудительно перерисуем
    this._render();
  }

  _render(){
    const { W, H } = this._calcGrid();

    // подготовим канвас
    this.canvas.width  = W;
    this.canvas.height = H;

    // уменьшаем видео в канвас
    this.ctx.drawImage(this.video, 0, 0, W, H);
    const img = this.ctx.getImageData(0,0,W,H).data;

    const { contrast, gamma, invert } = this.opts;
    const g = 1/Math.max(0.1, Math.min(3, gamma));
    const chars = this.chars;

    let out = '';
    for (let y=0; y<H; y++){
      let row = '';
      for (let x=0; x<W; x++){
        const i = ((y*W)+x)*4;
        let r=img[i], gch=img[i+1], b=img[i+2];

        // яркость
        let v = (r*0.2126 + gch*0.7152 + b*0.0722) / 255;

        // гамма / контраст
        v = Math.pow(v, g);
        v = (v - 0.5)*contrast + 0.5;

        // инверсия
        if (invert) v = 1 - v;

        // к диапазону
        v = Math.max(0, Math.min(1, v));

        const idx = Math.floor(v * (chars.length-1));
        row += chars[idx];
      }
      out += row + '\n';
    }

    this.out.textContent = out;
  }
}

/* экспорт в глобальную область */
window.AsciiPlayer = AsciiPlayer;
