import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ProductService } from '../../services/product.service';

@Component({
  standalone: true,
  selector: 'app-product-create',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-create.component.html',
  styleUrls: ['./product-create.component.css'],
})
export class ProductCreateComponent {
  // ✅ Inyección con `inject()` evita el error TS2729
  private fb = inject(FormBuilder);
  private api = inject(ProductService);
  private platformId = inject(PLATFORM_ID);

  // Usa getter para evaluar en tiempo de uso (no en inicialización de campos)
  get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  saving = signal(false);
  err = signal<string | null>(null);
  msg = signal<string | null>(null);

  // ✅ `fb` ya está definido arriba, así que esto es seguro
  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    author: ['', [Validators.required, Validators.maxLength(120)]],
    publish_year: [new Date().getFullYear(), [Validators.required, Validators.min(1900), Validators.max(2100)]],
    price: [0, [Validators.required, Validators.min(0)]],
    cover_url: ['', [Validators.required, Validators.maxLength(500)]],
  });

  submit() {
    if (!this.isBrowser) return;
    this.err.set(null);
    this.msg.set(null);
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.saving.set(true);
    const dto = {
      title: this.form.value.title!,
      author: this.form.value.author!,
      publish_year: Number(this.form.value.publish_year),
      price: Number(this.form.value.price),
      cover_url: this.form.value.cover_url!,
    };

    this.api.createProduct(dto)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.msg.set('Producto creado correctamente.');
          this.form.reset({
            title: '',
            author: '',
            publish_year: new Date().getFullYear(),
            price: 0,
            cover_url: ''
          });
        },
        error: (e) => {
          if (e?.status === 401) this.err.set('Tu sesión expiró o no estás autenticado.');
          else if (e?.status === 403) this.err.set('No tienes permisos (requiere rol psicólogo).');
          else if (e?.error?.message === 'PRODUCT EXISTS') this.err.set('Ya existe un producto con ese título.');
          else this.err.set(e?.error?.message || 'No se pudo crear el producto.');
        }
      });
  }
}
