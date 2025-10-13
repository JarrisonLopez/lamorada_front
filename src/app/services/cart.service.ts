import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  BehaviorSubject, Observable, of, firstValueFrom
} from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ProductService } from './product.service';

/** ==== Tipos alineados con tu modelo ==== */
export interface CartProduct {
  _id: string;
  title: string;
  author: string;
  publish_year: number;
  price: number;
  cover_url: string;
}
export interface CartLine {
  /** Puede ser id o el producto enriquecido */
  product_id: string | CartProduct;
  quantity: number;
}
export interface CartResponse {
  products_id: CartLine[];
  total: number;
}

/** Estado del carrito sombra en localStorage */
interface ShadowCart {
  user_id: string | null;
  products: CartLine[];  // mismas líneas que CartResponse.products_id
  total: number;
}

function isCartProduct(p: string | CartProduct | undefined): p is CartProduct {
  return !!p && typeof p !== 'string';
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app/cart';
  private SHADOW_KEY = 'shadow_cart';

  /** stream para notificar cambios sin bloquear la UI */
  private _cart$ = new BehaviorSubject<CartResponse>({ products_id: [], total: 0 });
  cart$ = this._cart$.asObservable();

  constructor(private http: HttpClient, private productSvc: ProductService) {
    // Cargar sombra al iniciar (solo en navegador)
    const shadow = this.loadShadow();
    this._cart$.next(this.toCartResponse(shadow));
  }

  // -------------------- Helpers --------------------
  private getAuthOptions(): { headers: HttpHeaders } {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    try {
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) headers = headers.set('Authorization', `Bearer ${token}`);
      }
    } catch { /* noop */ }
    return { headers };
  }

  private loadShadow(): ShadowCart {
    try {
      if (typeof localStorage === 'undefined') return { user_id: null, products: [], total: 0 };
      const raw = localStorage.getItem(this.SHADOW_KEY);
      if (!raw) return { user_id: null, products: [], total: 0 };
      const parsed = JSON.parse(raw) as ShadowCart;
      return {
        user_id: parsed.user_id ?? null,
        products: Array.isArray(parsed.products) ? parsed.products : [],
        total: typeof parsed.total === 'number' ? parsed.total : 0,
      };
    } catch {
      return { user_id: null, products: [], total: 0 };
    }
  }

  private getPrice(l: CartLine): number {
    // precio desde product_id como objeto; fallback por compatibilidad
    // @ts-ignore
    const fromObj = isCartProduct(l.product_id) ? Number(l.product_id.price ?? 0) : 0;
    // @ts-ignore
    const fromFlat = Number((l as any).price ?? 0);
    return fromObj || fromFlat || 0;
  }

  private computeTotal(lines: CartLine[]): number {
    const total = (lines || []).reduce((s, l) => s + this.getPrice(l) * Number(l.quantity || 1), 0);
    return Number(total.toFixed(2));
  }

  private saveShadow(cart: ShadowCart) {
    cart.total = this.computeTotal(cart.products);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.SHADOW_KEY, JSON.stringify(cart));
      }
    } catch { /* noop */ }
    // Notifica a la UI cada vez que guardamos
    this._cart$.next(this.toCartResponse(cart));
  }

  private toCartResponse(sc: ShadowCart): CartResponse {
    return { products_id: sc.products ?? [], total: sc.total };
  }

  /** Hidrata líneas por id (best-effort) sin bloquear */
  private async hydrateShadowInBackground(shadow: ShadowCart) {
    // ids que no están enriquecidos (no tienen objeto con price/title)
    const needs = shadow.products.filter(l => {
      const p = l.product_id as any;
      return typeof p === 'string' || (p && typeof p.price !== 'number');
    });
    if (needs.length === 0) return;

    try {
      // 1 sola llamada a getAll y hacemos diccionario (evita n llamadas)
      const all: any[] = await firstValueFrom(
        this.productSvc.getAll().pipe(timeout(4000), catchError(() => of([])))
      );
      const byId: Record<string, any> = {};
      for (const p of all || []) byId[String(p._id)] = p;

      // Enriquecer donde aplique
      let mutated = false;
      for (const l of shadow.products) {
        const id = isCartProduct(l.product_id) ? l.product_id._id : l.product_id;
        if (!id) continue;
        const f = byId[id];
        if (!f) continue;
        // si aún no es objeto completo, reemplaza
        if (!isCartProduct(l.product_id) || typeof l.product_id.price !== 'number') {
          l.product_id = {
            _id: String(f._id),
            title: f.title,
            author: f.author,
            publish_year: Number(f.publish_year || f.year || 0),
            price: Number(f.price || 0),
            cover_url: f.cover_url
          };
          mutated = true;
        }
      }
      if (mutated) this.saveShadow(shadow); // re-calcula total y notifica
    } catch {
      /* silencioso: no bloquea */
    }
  }

  // -------------------- RAW backend --------------------
  private apiAdd(product_id: string, quantity: number) {
    return this.http.post(`${this.baseUrl}/add`, { product_id, quantity }, this.getAuthOptions())
      .pipe(timeout(4000), catchError(() => of(null)));
  }
  private apiGet() {
    return this.http.get(this.baseUrl, this.getAuthOptions())
      .pipe(timeout(4000), catchError(() => of(null)));
  }
  private apiRemove(product_id: string) {
    return this.http.post(`${this.baseUrl}/remove`, { product_id }, this.getAuthOptions())
      .pipe(timeout(4000), catchError(() => of(null)));
  }
  private apiClear() {
    return this.http.post(`${this.baseUrl}/clear`, {}, this.getAuthOptions())
      .pipe(timeout(4000), catchError(() => of(null)));
  }

  // -------------------- API pública (OPTIMISTA con hint) --------------------
  /** Emite de inmediato (sombra) y hace back/hidratación en background. */
  addProduct(
    product_id: string,
    quantity: number,
    hint?: Partial<CartProduct>   // pista opcional con precio/título/cover
  ): Observable<CartResponse> {
    const q = Math.max(1, Number(quantity || 1));
    const shadow = this.loadShadow();

    // 1) Actualiza sombra y EMITE ya (optimista, con hint si viene)
    const idx = shadow.products.findIndex(l => {
      const id = isCartProduct(l.product_id) ? l.product_id._id : l.product_id;
      return id === String(product_id);
    });

    if (idx >= 0) {
      // aumenta qty y, si hay hint con price/título/cover, enriquece
      shadow.products[idx].quantity += q;

      if (hint) {
        if (!isCartProduct(shadow.products[idx].product_id)) {
          shadow.products[idx].product_id = {
            _id: String(product_id),
            title: hint.title ?? '',
            author: hint.author ?? '',
            publish_year: Number(hint.publish_year ?? 0),
            price: Number(hint.price ?? 0),
            cover_url: hint.cover_url ?? '',
          };
        } else {
          const p = shadow.products[idx].product_id;
          shadow.products[idx].product_id = {
            _id: p._id,
            title: p.title || hint.title || '',
            author: p.author || hint.author || '',
            publish_year: Number(p.publish_year || hint.publish_year || 0),
            price: Number(typeof p.price === 'number' && p.price > 0 ? p.price : (hint.price ?? 0)),
            cover_url: p.cover_url || hint.cover_url || '',
          };
        }
      }
    } else {
      // inserta nueva línea (si hay hint, ya entra con objeto completo y precio)
      shadow.products.push({
        product_id: hint ? {
          _id: String(product_id),
          title: hint.title ?? '',
          author: hint.author ?? '',
          publish_year: Number(hint.publish_year ?? 0),
          price: Number(hint.price ?? 0),
          cover_url: hint.cover_url ?? '',
        } : String(product_id),
        quantity: q,
      });
    }

    shadow.total = this.computeTotal(shadow.products);
    this.saveShadow(shadow);              // emite a BehaviorSubject inmediatamente

    // 2) Backend en background (no bloquea)
    this.apiAdd(product_id, q).subscribe({ next: () => {}, error: () => {} });

    // 3) Hidratación en background (si no hubo hint o faltan datos)
    this.hydrateShadowInBackground(shadow);

    // 4) Respuesta inmediata
    return of(this.toCartResponse(shadow));
  }

  /** Devuelve lo que haya YA; luego sincroniza en background. */
  getCart(): Observable<CartResponse> {
    const shadow = this.loadShadow();
    // Emitimos inmediato
    const immediate = of(this.toCartResponse(shadow));

    // Background: intentar servidor; si trae líneas, sincroniza sombra; sino hidrata
    this.apiGet().subscribe((apiResp: any) => {
      try {
        const serverLines: any[] =
          apiResp && apiResp.products_id ? apiResp.products_id : (apiResp?.cart?.products_id || []);

        if (Array.isArray(serverLines) && serverLines.length > 0) {
          const mapped: CartLine[] = serverLines.map((l: any) => ({
            product_id: l.product_id?._id
              ? ({
                  _id: String(l.product_id._id),
                  title: l.product_id.title,
                  author: l.product_id.author,
                  publish_year: Number(l.product_id.publish_year || l.product_id.year || 0),
                  price: Number(l.product_id.price || 0),
                  cover_url: l.product_id.cover_url
                } as CartProduct)
              : String(l.product_id || ''),
            quantity: Number(l.quantity || 1),
          }));
          const merged: ShadowCart = { user_id: shadow.user_id, products: mapped, total: this.computeTotal(mapped) };
          this.saveShadow(merged); // notifica a la UI
        } else {
          // Nada del back → hidratar sombra si hace falta
          this.hydrateShadowInBackground(shadow);
        }
      } catch {
        /* noop */
      }
    });

    return immediate;
  }

  removeProduct(product_id: string): Observable<CartResponse> {
    const shadow = this.loadShadow();
    const filtered = shadow.products.filter(l => {
      const id = isCartProduct(l.product_id) ? l.product_id._id : l.product_id;
      return id !== String(product_id);
    });
    const updated: ShadowCart = { ...shadow, products: filtered, total: this.computeTotal(filtered) };
    this.saveShadow(updated); // emite ya

    // background
    this.apiRemove(product_id).subscribe({ next: () => {}, error: () => {} });

    return of(this.toCartResponse(updated));
  }

  clearCart(): Observable<CartResponse> {
    const cleared: ShadowCart = { user_id: this.loadShadow().user_id, products: [], total: 0 };
    this.saveShadow(cleared); // emite ya
    this.apiClear().subscribe({ next: () => {}, error: () => {} }); // background
    return of(this.toCartResponse(cleared));
  }
}
