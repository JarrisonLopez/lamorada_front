import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  Renderer2,
  ViewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
})
export class FooterComponent implements AfterViewInit, OnDestroy {
  year = new Date().getFullYear();

  @ViewChild('root', { static: true })
  root!: ElementRef<HTMLElement>;

  private isBrowser = false;

  /** Guardamos el observer si existe (lo tipamos como any para no depender de typings de ResizeObserver) */
  private ro: any | undefined;
  private removeResizeListener?: () => void;

  constructor(
    private rd: Renderer2,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    const body = this.doc.body;
    const html = this.doc.documentElement;
    const footerEl = this.root.nativeElement;

    // Activa modo "footer fijo" en body (idempotente)
    if (!body.classList.contains('lm-has-fixed-footer')) {
      this.rd.addClass(body, 'lm-has-fixed-footer');
    }

    const setVar = (h: number) => {
      html.style.setProperty('--lm-footer-h', `${Math.max(1, Math.round(h))}px`);
    };

    const updateSize = () => {
      const rect = footerEl.getBoundingClientRect();
      setVar(rect.height || 96);
    };

    // --- Soporte ancho: usamos ResizeObserver si existe; si no, fallback a resize ---
    const RO: any = (window as any).ResizeObserver; // <- casting a any para evitar el error de typings
    if (RO) {
      this.ro = new RO(() => updateSize());
      this.ro.observe(footerEl);
    } else {
      const onResize = () => updateSize();
      window.addEventListener('resize', onResize);
      this.removeResizeListener = () => window.removeEventListener('resize', onResize);
    }

    // Primer cálculo + uno tardío por tipografías/carga de fuentes
    updateSize();
    setTimeout(updateSize, 80);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    // Limpiar observers/handlers
    try {
      if (this.ro && typeof this.ro.disconnect === 'function') {
        this.ro.disconnect();
      }
    } catch {
      /* noop */
    }
    this.removeResizeListener?.();

    // Retirar clase y variable del body/html
    const body = this.doc.body;
    const html = this.doc.documentElement;
    body.classList.remove('lm-has-fixed-footer');
    html.style.removeProperty('--lm-footer-h');
  }
}
