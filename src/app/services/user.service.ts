import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { AuthStateService } from '../core/state/auth-state.service';

export type Psychologist = { _id: string; name?: string; email?: string };

type JwtPayload = {
  _id?: string;
  id?: string;
  sub?: string;
  user_id?: string;
  user?: { _id?: string; id?: string; name?: string; role?: string };
  name?: string;
  email?: string;
  role?: 'patient' | 'psychologist' | string;
  [k: string]: any;
};

@Injectable({ providedIn: 'root' })
export class UserService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private authState: AuthStateService,
  ) {}

  // ---------- SSR helpers ----------
  private isBrowser() { return isPlatformBrowser(this.platformId); }

  private lsGet(key: string): string | null {
    if (!this.isBrowser()) return null;
    try { return localStorage.getItem(key); } catch { return null; }
  }
  private lsSet(key: string, value: string) {
    if (!this.isBrowser()) return;
    try { localStorage.setItem(key, value); } catch {}
  }
  private lsRemove(key: string) {
    if (!this.isBrowser()) return;
    try { localStorage.removeItem(key); } catch {}
  }

  // ---------- Token / sesión ----------
  getToken(): string | null { return this.lsGet('token'); }
  setToken(t: string) {
    this.lsSet('token', t);
    this.authState.setAuth({ isLogged: !!t, token: t });
  }
  clearToken() {
    this.lsRemove('token');
    this.lsRemove('role');
    this.lsRemove('name');
    this.authState.clear();
  }

  getRole(): string | null { return this.lsGet('role'); }
  setRole(r: string) {
    this.lsSet('role', r);
    this.authState.setAuth({ role: r as any, isLogged: !!this.getToken(), token: this.getToken() });
  }

  getName(): string | null { return this.lsGet('name'); }
  setName(n: string) {
    this.lsSet('name', n);
    this.authState.setAuth({ name: n, isLogged: !!this.getToken(), token: this.getToken() });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  // ---------- JWT utils (tolerante) ----------
  private decodeJwt<T = JwtPayload>(jwt: string | null): T | null {
    if (!jwt) return null;
    try {
      const [, payloadB64] = jwt.split('.');
      // Base64 URL-safe -> estándar
      const normalized = payloadB4ToStd(payloadB64);
      const json = atob(normalized);
      return JSON.parse(json) as T;
    } catch { return null; }

    function payloadB4ToStd(b64: string): string {
      // reemplaza - _ y rellena =
      let s = (b64 || '').replace(/-/g, '+').replace(/_/g, '/');
      const pad = s.length % 4;
      if (pad) s += '='.repeat(4 - pad);
      return s;
    }
  }

  /** Público: útil cuando /user/me devuelve 404 y debemos completar desde el JWT */
  public deriveRoleAndNameFromJwt(jwt: string | null): { role?: string; name?: string; email?: string } {
    const p = this.decodeJwt<JwtPayload>(jwt);
    const role = p?.role ?? p?.user?.role;
    const name = p?.name ?? p?.user?.name;
    const email = (p as any)?.email;
    return { role, name, email };
  }

  // Intenta poblar role/name desde /user/me; si falla, cae a decode del JWT
  bootstrapFromToken(): Observable<{ role?: string; name?: string }> {
    const jwt = this.getToken();
    if (!jwt) return of({});

    return this.getMe().pipe(
      tap((me: any) => {
        if (me?.role) this.setRole(me.role);
        if (me?.name) this.setName(me.name);
      }),
      map((me: any) => {
        const role = me?.role ?? this.getRole() ?? this.deriveRoleAndNameFromJwt(jwt).role;
        const name = me?.name ?? this.getName() ?? this.deriveRoleAndNameFromJwt(jwt).name;
        if (role && !this.getRole()) this.setRole(role);
        if (name && !this.getName()) this.setName(name);
        return { role, name };
      }),
      catchError(() => {
        const { role, name } = this.deriveRoleAndNameFromJwt(jwt);
        if (role) this.setRole(role);
        if (name) this.setName(name ?? '');
        return of({ role, name });
      })
    );
  }

  // ---------- AUTH ----------
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, { email, password });
  }

  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/logout`, {}, { headers: this.getAuthHeaders() })
      .pipe(tap(() => this.clearToken()));
  }

  // ---------- USER ----------
  register(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/user/register`, data);
  }

  getMe(): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/me`, { headers: this.getAuthHeaders() });
  }

  /** Versión tolerante: si /user/me responde 404, devuelve null en lugar de romper */
  getMeSafe(): Observable<any | null> {
    return this.http.get(`${this.baseUrl}/user/me`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError((err) => {
          if (err?.status === 404) return of(null);
          throw err;
        })
      );
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

  /**
   * Devuelve siempre { list: Psychologist[] }.
   * Tolera r.psychologists | r.users | r.data | r.result | r.items
   * y normaliza id como _id buscando: _id | id | user_id | uid.
   */
  getPsychologists(): Observable<{ list: Psychologist[]; error?: any }> {
    return this.http
      .get(`${this.baseUrl}/user/get-psychologists`, { headers: this.getAuthHeaders() })
      .pipe(
        map((r: any) => {
          const raw =
            r?.psychologists ??
            r?.users ??
            r?.data ??
            r?.result ??
            r?.items ??
            [];
          const list: Psychologist[] = (Array.isArray(raw) ? raw : []).map((u: any) => {
            const _id = u?._id ?? u?.id ?? u?.user_id ?? u?.uid ?? '';
            return {
              _id: String(_id),
              name: u?.name ?? u?.fullName ?? u?.fullname ?? u?.firstName ?? '',
              email: u?.email ?? u?.mail ?? '',
            };
          }).filter(p => !!p._id);
          // eslint-disable-next-line no-console
          console.debug('[getPsychologists] normalizado:', list);
          return { list };
        }),
        catchError((err) => {
          // eslint-disable-next-line no-console
          console.error('[getPsychologists] error:', err);
          return of({ list: [], error: err });
        })
      );
  }

  getPsychologistsBySpecialty(specialty: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/by-specialty?specialty=${encodeURIComponent(specialty)}`,
      { headers: this.getAuthHeaders() });
  }

  deleteMe(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/user/delete-me`, { headers: this.getAuthHeaders() });
  }
}
