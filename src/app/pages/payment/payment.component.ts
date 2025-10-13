import { Component, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { PaymentService } from '../../services/payment.service';

@Component({
  standalone: true,
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css'],
  imports: [CommonModule, DatePipe],
})
export class PaymentComponent {
  payments = signal<any[]>([]);
  constructor(private pay: PaymentService) {}
  ngOnInit() { this.refresh(); }
  refresh() {
    this.pay.getPayments().subscribe({ next: (res) => this.payments.set(res || []) });
  }
  remove(id: string) {
    this.pay.deletePayment(id).subscribe(() => this.refresh());
  }
}
