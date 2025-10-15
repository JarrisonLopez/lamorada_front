import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface PostDto {
  title: string;
  content: string;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PostApiService {
  private readonly baseUrl = 'https://la-morada-back-production.up.railway.app/post';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  private authHeaders(): HttpHeaders {
    let token: string | null = null;
    if (isPlatformBrowser(this.platformId)) {
      try { token = localStorage.getItem('token'); } catch {}
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return new HttpHeaders(headers);
  }

  /** Lista pública (active !== false) */
  getPublic(): Observable<any[]> {
    return this.http.get<any>(this.baseUrl).pipe(
      map(r => Array.isArray(r) ? r : (r?.posts ?? []))
    );
  }

  /** Crear publicación (psicólogo). Prioriza /post/create; fallback /post */
  create(data: PostDto): Observable<any> {
    const headers = this.authHeaders();
    return this.http.post(`${this.baseUrl}/create`, data, { headers }).pipe(
      catchError(err => {
        if (err?.status === 404 || err?.status === 405) {
          return this.http.post(this.baseUrl, data, { headers });
        }
        return throwError(() => err);
      })
    );
  }

  /** Obtener posts (autenticado). Si el back no filtra por autor, se filtra en cliente. */
  getAllRawAuth(): Observable<any[]> {
    const headers = this.authHeaders();
    return this.http.get<any>(this.baseUrl, { headers }).pipe(
      map(r => Array.isArray(r) ? r : (r?.posts ?? []))
    );
  }

  /** Actualizar (autor) */
  update(id: string, patch: Partial<PostDto>): Observable<any> {
    const headers = this.authHeaders();
    return this.http.put(`${this.baseUrl}/${id}`, patch, { headers });
  }

  /** Eliminar (autor) */
  remove(id: string): Observable<any> {
    const headers = this.authHeaders();
    return this.http.delete(`${this.baseUrl}/${id}`, { headers });
  }
}
