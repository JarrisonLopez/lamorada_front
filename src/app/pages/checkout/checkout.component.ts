import { Component } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { PaymentService } from '../../services/payment.service';

type PaymentRow = {
  _id: string;
  card_number: string;
  card_name: string;
  expiration_date: string; // MM/AA
};

@Component({
  standalone: true,
  selector: 'app-checkout',
  imports: [CommonModule, NgIf, NgFor, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
})
export class CheckoutComponent {
  loading = true;
  cards: PaymentRow[] = [];
  paying = false;

  // si ya calculas total desde el carrito, tráelo de tu CartService; aquí fijo un ejemplo
  total = 120000; // COP

  constructor(private pay: PaymentService, private router: Router) {}

  ngOnInit() {
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

  async onPay(card: PaymentRow) {
    // IMPORTANTE: tu backend NO tiene endpoint de cobro. Aquí solo simulamos.
    // Cuando tengas un endpoint tipo POST /checkout o /orders/charge, cámbialo aquí.
    this.paying = true;
    try {
      // Simulación de cobro OK
      await new Promise((r) => setTimeout(r, 800));
      alert(`Pago aprobado con ${this.mask(card.card_number)} por $${this.total.toLocaleString()}`);
      // TODO: aquí podrías limpiar el carrito y redirigir a /home o /orders
      this.router.navigateByUrl('/home');
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
