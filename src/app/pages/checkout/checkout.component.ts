import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgIf, NgFor, isPlatformBrowser, CurrencyPipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PaymentService } from '../../services/payment.service';
// Intento de integración suave (si existe); si no, caemos a localStorage
import { CartService } from '../../services/cart.service';

type PaymentRow = {
  _id: string;
  card_number: string;
  card_name: string;
  expiration_date: string; // MM/AA
};

type CartLine = {
  product_id: string;
  title?: string;
  price: number;
  quantity: number;
  cover_url?: string;
};

@Component({
  standalone: true,
  selector: 'app-checkout',
  imports: [CommonModule, NgIf, NgFor, RouterLink, CurrencyPipe],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
})
export class CheckoutComponent {
  constructor(
    private pay: PaymentService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    // Nota: si CartService no existe en tu proyecto, Angular lo ignorará (no rompe).
    private cartSrv?: CartService,
  ) {}

  // ---- estado UI ----
  loadingPayments = true;
  loadingCart = true;
  paying = false;

  cards: PaymentRow[] = [];
  lines: CartLine[] = [];

  subtotal = 0;
  total = 0;

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit() {
    if (!this.isBrowser) {
      this.loadingPayments = false;
      this.loadingCart = false;
      return;
    }
    this.loadPayments();
    this.loadCartAndTotal();
  }

  // ====== MÉTODOS DE PAGO ======
  private loadPayments() {
    this.loadingPayments = true;
    this.pay.getPayments()
      .pipe(finalize(() => (this.loadingPayments = false)))
      .subscribe({
        next: (r) => {
          const raw = r?.payments ?? r ?? [];
          this.cards = (Array.isArray(raw) ? raw : []) as PaymentRow[];
        },
        error: () => { this.cards = []; },
      });
  }

  // ====== CARRITO / TOTAL ======
  private loadCartAndTotal() {
    this.loadingCart = true;

    // 1) Intentar vía CartService con diferentes APIs comunes (tolerante)
    try {
      // snapshot síncrono (getSnapshot / getCartSnapshot)
      // @ts-expect-error: tolerante a implementaciones distintas
      const snap = this.cartSrv?.getSnapshot?.() ?? this.cartSrv?.getCartSnapshot?.();
      if (snap) {
        const arr = (snap.products_id ?? snap.lines ?? snap.items ?? []) as any[];
        this.lines = this.mapLines(arr);
        this.recalc();
        this.loadingCart = false;
        return;
      }

      // observable (cart$ / cartObservable$)
      // @ts-expect-error
      const obs$ = this.cartSrv?.cart$ || this.cartSrv?.cartObservable$ || null;
      if (obs$?.subscribe) {
        const sub = obs$.subscribe({
          next: (snap2: any) => {
            const arr = (snap2?.products_id ?? snap2?.lines ?? snap2?.items ?? []) as any[];
            this.lines = this.mapLines(arr);
            this.recalc();
            this.loadingCart = false;
            sub?.unsubscribe?.();
          },
          error: () => this.loadCartFromLocalStorage(),
        });
        return;
      }
    } catch {
      // sigue a localStorage
    }

    // 2) Fallback: localStorage (carrito sombra)
    this.loadCartFromLocalStorage();
  }

  private loadCartFromLocalStorage() {
    try {
      const raw =
        localStorage.getItem('cart') ||
        localStorage.getItem('shadow_cart') ||
        localStorage.getItem('cart_shadow');
      if (raw) {
        const obj = JSON.parse(raw);
        const arr = (obj?.products_id ?? obj?.lines ?? obj?.items ?? []) as any[];
        this.lines = this.mapLines(arr);
      } else {
        this.lines = [];
      }
    } catch {
      this.lines = [];
    }
    this.recalc();
    this.loadingCart = false;
  }

  private mapLines(arr: any[]): CartLine[] {
    return (arr || []).map((it: any) => ({
      product_id: String(it?.product_id?._id ?? it?.product_id ?? ''),
      title: it?.title ?? it?.product_id?.title ?? '',
      price: Number(it?.price ?? it?.product_id?.price ?? 0),
      quantity: Number(it?.quantity ?? 1),
      cover_url: it?.cover_url ?? it?.product_id?.cover_url ?? '',
    })).filter(x => x.product_id);
  }

  private recalc() {
    this.subtotal = this.lines.reduce((acc, l) => acc + l.price * l.quantity, 0);
    this.total = this.subtotal; // aquí puedes sumar envío/impuestos si aplica
  }

  // ====== ACCIONES ======
  mask(n: string) {
    const s = String(n ?? '').replace(/\s+/g, '');
    if (s.length <= 4) return s;
    return '**** **** **** ' + s.slice(-4);
  }

  async onPay(card: PaymentRow) {
    if (!this.lines.length) { alert('Tu carrito está vacío.'); return; }
    this.paying = true;
    try {
      // Simulación de cobro (no hay endpoint real en el back)
      await new Promise((r) => setTimeout(r, 700));
      alert(`Pago aprobado con ${this.mask(card.card_number)} por ${this.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`);

      // Limpiar carrito:
      let cleared = false;
      try {
        // @ts-expect-error: tolerante
        this.cartSrv?.clear?.();
        // @ts-expect-error
        this.cartSrv?.empty?.();
        cleared = true;
      } catch {}
      if (!cleared) {
        try {
          localStorage.removeItem('cart');
          localStorage.removeItem('shadow_cart');
          localStorage.removeItem('cart_shadow');
        } catch {}
      }

      this.lines = [];
      this.recalc();
      this.router.navigateByUrl('/product');
    } catch {
      alert('No se pudo procesar el pago.');
    } finally {
      this.paying = false;
    }
  }

  goToAddCard() {
    this.router.navigateByUrl('/payment');
  }
}
