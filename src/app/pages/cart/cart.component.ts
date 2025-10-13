import { Component, inject } from '@angular/core';
import { CommonModule, NgIf, NgFor, CurrencyPipe } from '@angular/common';
import { CartService, CartResponse, CartLine, CartProduct } from '../../services/cart.service';

@Component({
  standalone: true,
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css'],
  imports: [CommonModule, NgIf, NgFor, CurrencyPipe],
})
export class CartComponent {
  private cartSvc = inject(CartService);

  loading = false;
  err = '';
  msg = '';
  items: CartLine[] = [];
  total = 0;

  ngOnInit() {
    // Muestra de una vez el shadow cart y luego sincroniza en background
    this.loading = true;
    this.cartSvc.cart$.subscribe((resp: CartResponse) => {
      this.items = resp.products_id ?? [];
      this.total = resp.total ?? 0;
      this.loading = false;
    });
    this.cartSvc.getCart().subscribe(); // dispara sync en background
  }

  /** ---------- Helpers para leer datos del producto ---------- */
  private isObj(p: string | CartProduct | undefined): p is CartProduct {
    return !!p && typeof p !== 'string';
  }

  idOf(l: CartLine): string | null {
    return this.isObj(l.product_id) ? l.product_id._id : (l.product_id ?? null);
  }
  titleOf(l: CartLine): string {
    return this.isObj(l.product_id) ? (l.product_id.title ?? '') : '';
  }
  coverOf(l: CartLine): string {
    return this.isObj(l.product_id) ? (l.product_id.cover_url ?? '') : '';
  }
  priceOf(l: CartLine): number {
    // objeto → price; fallback a precio plano si existiera por compatibilidad
    // @ts-ignore
    const fromFlat = Number((l as any).price ?? 0);
    return this.isObj(l.product_id) ? Number(l.product_id.price ?? 0) : fromFlat || 0;
  }

  /** ---------- Acciones ---------- */
  inc(it: CartLine) {
    const id = this.idOf(it);
    if (!id) return;
    this.loading = true;
    this.cartSvc.addProduct(id, 1).subscribe({
      next: () => { this.msg = ''; this.loading = false; },
      error: () => { this.err = 'No se pudo aumentar la cantidad.'; this.loading = false; }
    });
  }

  dec(it: CartLine) {
    const id = this.idOf(it);
    if (!id) return;
    if ((it.quantity || 1) <= 1) return this.remove(it);
    this.loading = true;
    // Estrategia simple: remove y luego add con qty-1 (optimista emitida por el service)
    this.cartSvc.removeProduct(id).subscribe({
      next: () => {
        const newQty = (it.quantity || 1) - 1;
        this.cartSvc.addProduct(id, newQty).subscribe({
          next: () => { this.loading = false; },
          error: () => { this.err = 'No se pudo disminuir la cantidad.'; this.loading = false; }
        });
      },
      error: () => { this.err = 'No se pudo disminuir la cantidad.'; this.loading = false; }
    });
  }

  onQtyChange(it: CartLine, raw: string) {
    const id = this.idOf(it);
    if (!id) return;
    const qty = Math.max(1, Number(raw || 1));
    this.loading = true;
    this.cartSvc.removeProduct(id).subscribe({
      next: () => {
        this.cartSvc.addProduct(id, qty).subscribe({
          next: () => { this.loading = false; },
          error: () => { this.err = 'No se pudo actualizar la cantidad.'; this.loading = false; }
        });
      },
      error: () => { this.err = 'No se pudo actualizar la cantidad.'; this.loading = false; }
    });
  }

  remove(it: CartLine) {
    const id = this.idOf(it);
    if (!id) return;
    this.loading = true;
    this.cartSvc.removeProduct(id).subscribe({
      next: () => { this.msg = 'Producto eliminado.'; this.loading = false; },
      error: () => { this.err = 'No se pudo eliminar el producto.'; this.loading = false; }
    });
  }

  clear() {
    this.loading = true;
    this.cartSvc.clearCart().subscribe({
      next: () => { this.msg = 'Carrito vacío.'; this.loading = false; },
      error: () => { this.err = 'No se pudo vaciar el carrito.'; this.loading = false; }
    });
  }
}
