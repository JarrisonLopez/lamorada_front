import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { firstValueFrom } from 'rxjs';

type Product = {
  _id: string;
  title: string;
  author: string;
  publish_year: number;
  price: number;
  cover_url: string;
};

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.css'],
})
export class ProductComponent implements OnInit {
  loading = false;
  addingId: string | null = null;

  err: string | null = null;
  msg: string | null = null;

  products: Product[] = [];
  q = '';

  constructor(
    private prod: ProductService,
    private cart: CartService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return; // evitar llamadas en SSR
    await this.loadAll();
  }

  private async loadAll() {
    this.loading = true;
    this.err = null;
    this.msg = null;
    try {
      const resp = await firstValueFrom(this.prod.getAll());
      this.products = Array.isArray(resp) ? (resp as Product[]) : (resp?.products ?? []);
    } catch (e: any) {
      this.err = e?.error?.message || 'No se pudieron cargar los productos';
      this.products = [];
    } finally {
      this.loading = false;
    }
  }

  private isLogged(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try { return !!localStorage.getItem('token'); } catch { return false; }
  }

  async search() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.err = null;
    this.msg = null;
    this.loading = true;
    try {
      const q = (this.q || '').trim();
      if (!q) {
        await this.loadAll();
        return;
      }
      const resp = await firstValueFrom(this.prod.getByTitle(q));
      const list = Array.isArray(resp) ? resp : (resp?.products ?? (resp ? [resp] : []));
      this.products = list as Product[];
    } catch (e: any) {
      this.err = e?.error?.message || 'No se pudo buscar';
      this.products = [];
    } finally {
      this.loading = false;
    }
  }

  async addToCart(p: Product) {
    if (!isPlatformBrowser(this.platformId)) return;

    this.err = null;
    this.msg = null;

    // 1) Validar login
    if (!this.isLogged()) {
      this.err = 'Debes iniciar sesión para agregar al carrito.';
      return;
    }

    // 2) Validar id del producto
    const id = p?._id;
    if (!id) {
      this.err = 'No se encontró el identificador del producto (_id).';
      return;
    }

    // 3) Llamar a /cart/add con "hint" para que el precio/título/cover aparezcan al instante
    this.addingId = id;
    try {
      await firstValueFrom(
        this.cart.addProduct(id, 1, {
          title: p.title,
          author: p.author,
          publish_year: p.publish_year,
          price: p.price,
          cover_url: p.cover_url,
        })
      );
      this.msg = 'Producto agregado al carrito';
    } catch (e: any) {
      if (e?.status === 401) {
        this.err = 'Tu sesión expiró o no estás autenticado. Inicia sesión de nuevo.';
      } else if (e?.status === 403) {
        this.err = 'No tienes permisos para agregar al carrito.';
      } else {
        this.err = e?.error?.message || 'No se pudo agregar al carrito';
      }
    } finally {
      this.addingId = null;
    }
  }
}
