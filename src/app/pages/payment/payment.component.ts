import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgIf, NgFor, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { PaymentService } from '../../services/payment.service';

type PaymentRow = {
  _id: string;
  card_number: string;
  card_name: string;
  expiration_date: string; // MM/AA
  cvv?: string;
};

@Component({
  standalone: true,
  selector: 'app-payment',
  imports: [CommonModule, ReactiveFormsModule, NgIf, NgFor],
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css'],
})
export class PaymentComponent {
  loading = true;
  saving = false;
  deletingId: string | null = null;

  cards: PaymentRow[] = [];

  form!: FormGroup;

  constructor(
    private pay: PaymentService,
    private fb: FormBuilder,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // ¡IMPORTANTE! Inicializamos el form aquí (después de inyectar fb)
    this.form = this.fb.group({
      card_number: ['', [Validators.required, Validators.pattern(/^\d{13,19}$/)]], // solo dígitos 13-19
      card_name: ['', [Validators.required, Validators.minLength(2)]],
      expiration_date: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]], // MM/AA
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
    });
  }

  private get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit() {
    if (!this.isBrowser) { this.loading = false; return; }
    this.refresh();
  }

  refresh() {
    this.loading = true;
    this.pay.getPayments().subscribe({
      next: (r) => {
        const raw = r?.payments ?? r ?? [];
        this.cards = (Array.isArray(raw) ? raw : []) as PaymentRow[];
      },
      error: () => (this.cards = []),
      complete: () => (this.loading = false),
    });
  }

  mask(n: string) {
    const s = String(n ?? '').replace(/\s+/g, '');
    if (s.length <= 4) return s;
    return '**** **** **** ' + s.slice(-4);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      alert('Revisa los campos del formulario.');
      return;
    }

    // Normalizamos: card_number solo dígitos
    const payload = {
      card_number: String(this.form.value.card_number).replace(/\D+/g, ''),
      card_name: String(this.form.value.card_name).trim(),
      expiration_date: String(this.form.value.expiration_date).trim(),
      cvv: String(this.form.value.cvv).trim(),
    };

    this.saving = true;
    this.pay.createPayment(payload).subscribe({
      next: () => {
        alert('Método de pago guardado ✅');
        this.form.reset();
        this.refresh();
      },
      error: () => alert('No se pudo guardar el método de pago.'),
      complete: () => (this.saving = false),
    });
  }

  remove(id: string) {
    if (!confirm('¿Eliminar este método de pago?')) return;
    this.deletingId = id;
    this.pay.deletePayment(id).subscribe({
      next: () => this.refresh(),
      error: () => alert('No se pudo eliminar.'),
      complete: () => (this.deletingId = null),
    });
  }
}
