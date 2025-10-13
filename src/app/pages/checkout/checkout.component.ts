import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartService } from '../../services/cart.service';
import { PaymentService } from '../../services/payment.service';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
  imports: [CommonModule],
})
export class CheckoutComponent {
  cart = signal<any>({ items: [] });
  msg = signal<string>('');
  err = signal<string>('');

  constructor(private cartSvc: CartService, private pay: PaymentService, private router: Router) {}

  ngOnInit() {
    this.cartSvc.getCart().subscribe({ next: (res) => this.cart.set(res || { items: [] }) });
  }

  get total() {
    return (this.cart()?.items || []).reduce((s: number, it: any) => s + it.price * it.quantity, 0);
  }

  payNow() {
    this.msg.set('Procesando pago...');
    this.err.set('');
    this.pay.createPayment({ amount: this.total, method: 'card' }).subscribe({
      next: () => {
        this.msg.set('Pago exitoso');
        this.router.navigate(['/payment']);
      },
      error: () => {
        this.msg.set('');
        this.err.set('Error en el pago');
      },
    });
  }
}
