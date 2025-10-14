import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgFor, NgIf, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { PaymentService } from '../../services/payment.service';

type PaymentDoc = {
  _id: string;
  card_number: string;
  card_name: string;
  expiration_date: string; // MM/AA
  cvv?: string;
  createdAt?: string;
  updatedAt?: string;
};

@Component({
  standalone: true,
  selector: 'app-payment',
  imports: [CommonModule, ReactiveFormsModule, NgIf, NgFor],
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css'],
})
export class PaymentComponent {
  constructor(
    private fb: FormBuilder,
    private pay: PaymentService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.form = this.fb.group({
      card_number: ['', [Validators.required, Validators.pattern(/^\d{13,19}$/)]],
      card_name: ['', [Validators.required, Validators.minLength(2)]],
      expiration_date: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}$/)]], // MM/AA
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
    });
  }

  form!: FormGroup;

  loadingList = true;
  saving = false;
  deletingIds = new Set<string>();

  items: PaymentDoc[] = [];

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit() {
    if (!this.isBrowser) { this.loadingList = false; return; }
    this.refresh(true);
  }

  /** Refresca la lista. Con showSpinner=false no dejamos el UI en “Cargando…” */
  refresh(showSpinner = true) {
    if (showSpinner) this.loadingList = true;
    // eslint-disable-next-line no-console
    console.debug('[payment] refresh() spinner:', showSpinner);

    this.pay.getPayments()
      .pipe(finalize(() => {
        this.loadingList = false;
        // eslint-disable-next-line no-console
        console.debug('[payment] refresh() finalize -> loadingList=false');
      }))
      .subscribe({
        next: (r: any) => {
          const list: PaymentDoc[] = r?.payments ?? r ?? [];
          this.items = Array.isArray(list) ? list : [];
          // eslint-disable-next-line no-console
          console.debug('[payment] refresh() next items:', this.items.length);
        },
        error: (err) => {
          const msg = (err?.error?.message || err?.message || '').toString();
          alert(msg || 'No se pudo cargar tus métodos de pago.');
          this.items = [];
          // finalize ya apagó el spinner
          // eslint-disable-next-line no-console
          console.debug('[payment] refresh() error; spinner apagado por finalize');
        },
      });
  }

  mask(card: string) {
    if (!card) return '';
    const last4 = card.slice(-4);
    return `**** **** **** ${last4}`;
  }

  onSave() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;

    const body = {
      card_number: String(this.form.value.card_number).replace(/\s+/g, ''),
      card_name: this.form.value.card_name,
      expiration_date: this.form.value.expiration_date,
      cvv: this.form.value.cvv,
    };

    this.pay.createPayment(body)
      .pipe(finalize(() => {
        this.saving = false;
        // eslint-disable-next-line no-console
        console.debug('[payment] create finalize -> saving=false');
      }))
      .subscribe({
        next: (resp: any) => {
          alert('Método guardado ✅');
          // Actualización optimista
          const created: PaymentDoc | null = resp?.payment ?? null;
          if (created?._id) {
            this.items = [created, ...this.items];
          }
          this.form.reset();
          // Refresca sin spinner para no dejar “Cargando…”
          this.refresh(false);
        },
        error: (err) => {
          const msg = (err?.error?.message || err?.message || '').toString();
          alert(msg || 'No se pudo guardar el método de pago.');
        },
      });
  }

  onDelete(id: string) {
    if (!id) return;
    if (!confirm('¿Eliminar este método de pago?')) return;

    this.deletingIds.add(id);
    this.pay.deletePayment(id)
      .pipe(finalize(() => {
        this.deletingIds.delete(id);
        // eslint-disable-next-line no-console
        console.debug('[payment] delete finalize -> delete flag cleared');
      }))
      .subscribe({
        next: _ => {
          // Optimista: quita de la lista
          this.items = this.items.filter(x => x._id !== id);
          // Refresca sin spinner
          this.refresh(false);
        },
        error: (err) => {
          const msg = (err?.error?.message || err?.message || '').toString();
          alert(msg || 'No se pudo eliminar.');
        },
      });
  }
}
