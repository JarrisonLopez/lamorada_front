import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthStateService } from '../core/state/auth-state.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private authState: AuthStateService,
  ) {}

  // ---------- helpers SSR-safe ----------
  private isBrowser() { return isPlatformBrowser(this.platformId); }

  getToken(): string | null {
    if (!this.isBrowser()) return null;
    try { return localStorage.getItem('token'); } catch { return null; }
  }
  setToken(t: string) {
    if (!this.isBrowser()) return;
    try { localStorage.setItem('token', t); } catch {}
    this.authState.setAuth({ isLogged: !!t, token: t });
  }
  clearToken() {
    if (!this.isBrowser()) return;
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('name');
    } catch {}
    this.authState.clear();
  }
  getRole(): string | null {
    if (!this.isBrowser()) return null;
    try { return localStorage.getItem('role'); } catch { return null; }
  }
  setRole(r: string) {
    if (!this.isBrowser()) return;
    try { localStorage.setItem('role', r); } catch {}
    this.authState.setAuth({ role: r as any, isLogged: !!this.getToken(), token: this.getToken() });
  }
  setName(n: string) {
    if (!this.isBrowser()) return;
    try { localStorage.setItem('name', n); } catch {}
    this.authState.setAuth({ name: n, isLogged: !!this.getToken(), token: this.getToken() });
  }
  getName(): string | null {
    if (!this.isBrowser()) return null;
    try { return localStorage.getItem('name'); } catch { return null; }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  // ---------- AUTH ----------
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, { email, password });
  }

  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/logout`, {}, { headers: this.getAuthHeaders() });
  }

  // ---------- USER ----------
  register(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/user/register`, data);
  }

  getMe(): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/me`, { headers: this.getAuthHeaders() });
  }

  updateMe(data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/user/me`, data, { headers: this.getAuthHeaders() });
  }

  updateUser(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/user/${id}`, data, { headers: this.getAuthHeaders() });
  }

  getPatients(): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/get-patients`, { headers: this.getAuthHeaders() });
  }

  getPsychologists(): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/get-psychologists`);
  }

  getPsychologistsBySpecialty(specialty: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/by-specialty?specialty=${encodeURIComponent(specialty)}`);
  }

  deleteMe(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/user/delete-me`, { headers: this.getAuthHeaders() });
  }
}
