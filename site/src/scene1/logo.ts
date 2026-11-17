// The logo, with its glint: a diagonal highlight that travels across the chrome reel and along the tape.
// The highlight is clipped to the logo's own alpha, so swapping in the final PNG is only a file swap.
import { asset, loadImage } from './assets';
import { GLINT_MS } from './glint';
import { EASE_IN_OUT, gsap, reducedMotion } from './motion';

const GLINT_EVERY_MS = 9000;

export class Logo {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: HTMLImageElement;
  private sweep: gsap.core.Tween | null = null;
  private timer = 0;

  private constructor(image: HTMLImageElement, homeHref?: string) {
    this.image = image;
    // A link when the page gives it somewhere to go; otherwise just the mark.
    if (homeHref) {
      const link = document.createElement('a');
      link.href = homeHref;
      link.setAttribute('aria-label', 'HJaaS, Hui Jie as a Service');
      this.el = link;
    } else {
      this.el = document.createElement('div');
      this.el.setAttribute('role', 'img');
      this.el.setAttribute('aria-label', 'HJaaS, Hui Jie as a Service');
    }
    this.el.className = 'hj-logo';
    this.el.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;

    const img = document.createElement('img');
    img.src = image.src;
    img.alt = '';
    img.draggable = false;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d')!;
    this.el.append(img, this.canvas);

    this.el.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') this.glint();
    });
    this.el.addEventListener('focus', () => this.glint());
  }

  static async create(homeHref?: string): Promise<Logo> {
    return new Logo(await loadImage(asset('logo/logo.webp')), homeHref);
  }

  /** Start the idle glint, every nine seconds or so while the tab is visible. */
  startIdle(): void {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (!document.hidden) this.glint();
    }, GLINT_EVERY_MS);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.sweep?.kill();
  }

  /** One sweep, 650 ms, quick through the middle. A sweep already running is left to finish. */
  glint(): void {
    if (reducedMotion() || this.sweep?.isActive()) return;
    const cssW = this.el.clientWidth;
    const cssH = this.el.clientHeight;
    if (!cssW) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const { ctx, image } = this;
    const band = w * 0.2;
    const lean = 0.42; // the highlight leans like light off a turned edge
    const from = -band - h * lean;
    const to = w + band;
    const light = ctx.createLinearGradient(-band / 2, 0, band / 2, 0);
    light.addColorStop(0, 'rgba(255, 255, 255, 0)');
    light.addColorStop(0.32, 'rgba(255, 252, 240, 0.4)');
    light.addColorStop(0.5, 'rgba(255, 255, 255, 0.92)');
    light.addColorStop(0.68, 'rgba(255, 252, 240, 0.4)');
    light.addColorStop(1, 'rgba(255, 255, 255, 0)');

    const state = { p: 0 };
    this.sweep = gsap.to(state, {
      p: 1,
      duration: GLINT_MS / 1000,
      ease: EASE_IN_OUT,
      onUpdate: () => {
        const x = from + (to - from) * state.p;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);
        ctx.setTransform(1, 0, -lean, 1, x + h * lean, 0);
        ctx.fillStyle = light;
        ctx.fillRect(-band / 2, 0, band, h);
        // Keep the light only where the logo is.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(image, 0, 0, w, h);
      },
      onComplete: () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);
      },
    });
  }
}
