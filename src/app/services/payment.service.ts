import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app/payment';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private isBrowser() { return isPlatformBrowser(this.platformId); }

  private getAuthHeaders(): HttpHeaders {
    let token: string | null = null;
    if (this.isBrowser()) {
      try { token = localStorage.getItem('token'); } catch {}
    }
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  createPayment(data: { card_number: string; card_name: string; expiration_date: string; cvv: string }): Observable<any> {
    return this.http.post(this.baseUrl, data, { headers: this.getAuthHeaders() });
  }

  getPayments(): Observable<any> {
    return this.http.get(this.baseUrl, { headers: this.getAuthHeaders() });
  }

  deletePayment(paymentId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${encodeURIComponent(paymentId)}`, { headers: this.getAuthHeaders() });
  }
}
