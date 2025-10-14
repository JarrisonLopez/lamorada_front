import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthStateService } from '../core/state/auth-state.service';

export type Psychologist = { _id: string; name?: string; email?: string };

type JwtPayload = {
  _id?: string;
  id?: string;
  sub?: string;
  user_id?: string;
  user?: { _id?: string; id?: string; name?: string; role?: string; email?: string; phone?: string; age?: number; specialty?: string };
  name?: string;
  email?: string;
  role?: 'patient' | 'psychologist' | string;
  phone?: string;
  age?: number;
  specialty?: string;
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
  private lsGet(key: string): string | null { if (!this.isBrowser()) return null; try { return localStorage.getItem(key); } catch { return null; } }
  private lsSet(key: string, value: string) { if (!this.isBrowser()) return; try { localStorage.setItem(key, value); } catch {} }
  private lsRemove(key: string) { if (!this.isBrowser()) return; try { localStorage.removeItem(key); } catch {} }

  // ---------- Token / sesión ----------
  getToken(): string | null { return this.lsGet('token'); }
  setToken(t: string) { this.lsSet('token', t); this.authState.setAuth({ isLogged: !!t, token: t }); }
  clearToken() { this.lsRemove('token'); this.lsRemove('role'); this.lsRemove('name'); this.authState.clear(); }

  getRole(): string | null { return this.lsGet('role'); }
  setRole(r: string) { this.lsSet('role', r); this.authState.setAuth({ role: r as any, isLogged: !!this.getToken(), token: this.getToken() }); }

  getName(): string | null { return this.lsGet('name'); }
  setName(n: string) { this.lsSet('name', n); this.authState.setAuth({ name: n, isLogged: !!this.getToken(), token: this.getToken() }); }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({ 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' });
  }

  // ---------- JWT utils (tolerante) ----------
  private decodeJwt<T = JwtPayload>(jwt: string | null): T | null {
    if (!jwt) return null;
    try {
      const [, payloadB64] = jwt.split('.');
      let s = (payloadB64 || '').replace(/-/g, '+').replace(/_/g, '/');
      const pad = s.length % 4; if (pad) s += '='.repeat(4 - pad);
      const json = atob(s);
      return JSON.parse(json) as T;
    } catch { return null; }
  }

  /** Extrae id/rol/nombre/email (y si hay) phone/age/specialty del JWT, de forma tolerante */
  profileFromToken(jwt: string | null): {
    id?: string; role?: string; name?: string; email?: string; phone?: string; age?: number; specialty?: string;
  } {
    const p = this.decodeJwt<JwtPayload>(jwt);
    const id = p?._id ?? p?.id ?? p?.user_id ?? p?.user?._id ?? p?.user?.id ?? p?.sub;
    const role = p?.role ?? p?.user?.role;
    const name = p?.name ?? p?.user?.name;
    const email = p?.email ?? p?.user?.email;
    const phone = (p as any)?.phone ?? p?.user?.phone;
    const age = (p as any)?.age ?? p?.user?.age;
    const specialty = (p as any)?.specialty ?? p?.user?.specialty;
    return { id: id ? String(id) : undefined, role, name, email, phone, age, specialty };
  }

  // ---------- Bootstrap UI desde token (sin /user/me) ----------
  bootstrapFromToken(): Observable<{ role?: string; name?: string }> {
    const jwt = this.getToken();
    if (!jwt) return of({});
    const { role, name } = this.profileFromToken(jwt);
    if (role) this.setRole(role);
    if (name) this.setName(name);
    return of({ role, name });
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

  /**
   * Con este back **NO existe /user/me**.
   * - Si rol=psychologist: intenta completar el registro público con GET /user/get-psychologists.
   * - Si rol=patient: devuelve sólo lo que hay en el token.
   * Devuelve SIEMPRE un objeto "tipo User" (best-effort) para componentes que esperan _id/role/name/email.
   */
  getMe(): Observable<any> {
    const t = this.profileFromToken(this.getToken());
    const base = {
      _id: t.id ?? undefined,
      role: t.role ?? undefined,
      name: t.name ?? undefined,
      email: t.email ?? undefined,
      phone: t.phone ?? undefined,
      age: t.age ?? undefined,
      specialty: t.specialty ?? undefined,
    };

    if ((t.role ?? '').toLowerCase() === 'psychologist') {
      return this.http.get(`${this.baseUrl}/user/get-psychologists`).pipe(
        map((r: any) => {
          const list: any[] = (r?.users ?? r?.psychologists ?? r?.data ?? r?.items ?? []);
          const fromList = list.find(u =>
            String(u?._id ?? u?.id ?? u?.user_id ?? '') === String(t.id ?? '') ||
            String(u?.email ?? '') === String(t.email ?? '')
          ) || {};
          return { ...fromList, ...base, _id: base._id ?? fromList?._id };
        }),
        catchError(() => of(base))
      );
    }

    return of(base);
  }

  /** PUT /user/:id usando el id del JWT */
  updateMe(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/user/${encodeURIComponent(id)}`, data, { headers: this.getAuthHeaders() });
  }

  /** Conveniencia: usa id del token automáticamente */
  updateMeCompat(data: any): Observable<any> {
    const t = this.profileFromToken(this.getToken());
    if (!t.id) return of({ error: 'NO_ID_IN_TOKEN' });
    return this.updateMe(t.id, data);
  }

  getPatients(): Observable<any> {
    // requiere ser psicólogo (el back valida)
    return this.http.get(`${this.baseUrl}/user/get-patients`, { headers: this.getAuthHeaders() });
  }

  getPsychologists(): Observable<{ list: Psychologist[]; error?: any }> {
    return this.http.get(`${this.baseUrl}/user/get-psychologists`).pipe(
      map((r: any) => {
        const raw = r?.psychologists ?? r?.users ?? r?.data ?? r?.result ?? r?.items ?? [];
        const list: Psychologist[] = (Array.isArray(raw) ? raw : []).map((u: any) => {
          const _id = u?._id ?? u?.id ?? u?.user_id ?? u?.uid ?? '';
          return { _id: String(_id), name: u?.name ?? '', email: u?.email ?? '' };
        }).filter(p => !!p._id);
        return { list };
      }),
      catchError((err) => of({ list: [], error: err }))
    );
  }

  getPsychologistsBySpecialty(specialty: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/user/by-specialty?specialty=${encodeURIComponent(specialty)}`);
  }

  deleteMe(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/user/delete-me`, { headers: this.getAuthHeaders() });
  }
}
