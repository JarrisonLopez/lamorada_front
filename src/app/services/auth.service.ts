import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

export interface LoginDto {
  email: string;
  password: string;
}
export interface LoginResponse {
  success?: boolean;
  token?: string;
  role?: 'patient' | 'psychologist';
  user?: any;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = 'https://la-morada-back-production.up.railway.app';
  private readonly json = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  private isBrowser() { return isPlatformBrowser(this.platformId); }

  private decode<T = any>(token: string): T | null {
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      // @ts-ignore
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch { return null; }
  }

  /** Guarda token/rol/nombre de forma SSR-safe */
  private persist(token?: string) {
    if (!this.isBrowser() || !token) return { role: null as string | null, name: null as string | null };
    try {
      localStorage.setItem('token', token);
      const p: any = this.decode(token) || {};
      const role: string | null = p?.role ?? p?.user?.role ?? null;
      const name: string | null = p?.name ?? p?.user?.name ?? null;
      if (role) localStorage.setItem('role', role);
      if (name) localStorage.setItem('name', name);
      return { role, name };
    } catch { return { role: null, name: null }; }
  }

  /**
   * Intenta varios endpoints típicos hasta que uno responda 2xx:
   * 1) POST /auth/login
   * 2) POST /user/login
   * 3) POST /auth/sign-in
   * 4) POST /user/sign-in
   * 5) POST /login (último recurso)
   */
  login(body: LoginDto): Observable<LoginResponse> {
    const candidates = [
      `${this.base}/auth/login`,
      `${this.base}/user/login`,
      `${this.base}/auth/sign-in`,
      `${this.base}/user/sign-in`,
      `${this.base}/login`,
    ];

    const tryAt = (i: number): Observable<LoginResponse> => {
      if (i >= candidates.length) return throwError(() => new Error('LOGIN_NOT_FOUND'));
      const url = candidates[i];
      return this.http.post<LoginResponse>(url, body, { headers: this.json }).pipe(
        switchMap((res) => {
          // back puede devolver {success, token} o {token} solo
          const token = (res as any)?.token;
          if (!token) {
            // si no hay token, probar siguiente endpoint
            return tryAt(i + 1);
          }
          this.persist(token);
          return of(res);
        }),
        catchError((e) => {
          // 404/405 -> probar siguiente; otros errores -> propagar
          if (e?.status === 404 || e?.status === 405) return tryAt(i + 1);
          return throwError(() => e);
        })
      );
    };

    return tryAt(0);
  }
}
