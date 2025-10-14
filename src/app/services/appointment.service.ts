import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app/appointment';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  private isBrowser() { return isPlatformBrowser(this.platformId); }
  private headers(): HttpHeaders {
    let t: string | null = null;
    if (this.isBrowser()) { try { t = localStorage.getItem('token'); } catch {} }
    return new HttpHeaders({ 'Content-Type': 'application/json', Authorization: t ? `Bearer ${t}` : '' });
  }

  create(body: any): Observable<any> { return this.http.post(this.baseUrl, body, { headers: this.headers() }); }
  getAll(): Observable<any>       { return this.http.get(this.baseUrl, { headers: this.headers() }); }
  delete(id: string): Observable<any> { return this.http.delete(`${this.baseUrl}/${id}`, { headers: this.headers() }); }
  updateStatus(id: string, status: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}/status`, { status }, { headers: this.headers() });
  }
}
