import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app/product';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  createProduct(data: any): Observable<any> {
    return this.http.post(this.baseUrl, data, { headers: this.getAuthHeaders() });
  }

  getByTitle(title: string): Observable<any> {
    return this.http.get(`${this.baseUrl}?title=${title}`);
  }

  getAll(): Observable<any> {
    return this.http.get(`${this.baseUrl}/all`);
  }
}