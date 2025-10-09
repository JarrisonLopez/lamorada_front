import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app/cart';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  addProduct(product_id: string, quantity: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/add`, { product_id, quantity }, { headers: this.getAuthHeaders() });
  }

  getCart(): Observable<any> {
    return this.http.get(this.baseUrl, { headers: this.getAuthHeaders() });
  }

  removeProduct(product_id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/remove`, { product_id }, { headers: this.getAuthHeaders() });
  }

  clearCart(): Observable<any> {
    return this.http.post(`${this.baseUrl}/clear`, {}, { headers: this.getAuthHeaders() });
  }
}