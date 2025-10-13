import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface CreatePodcastDto {
  title: string;
  description?: string;
  youtubeId: string;
}

@Injectable({ providedIn: 'root' })
export class PodcastService {
  private readonly baseUrl = 'https://la-morada-back-production.up.railway.app/podcast';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  private authHeaders(): HttpHeaders {
    let token: string | null = null;
    if (isPlatformBrowser(this.platformId)) {
      try { token = localStorage.getItem('token'); } catch {}
    }
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  getPodcasts(): Observable<any[]> {
    return this.http.get<any>(this.baseUrl).pipe(
      map(r => Array.isArray(r) ? r : (r?.podcasts ?? []))
    );
  }

  createPodcast(data: CreatePodcastDto): Observable<any> {
    const headers = this.authHeaders();
    return this.http.post(`${this.baseUrl}/create`, data, { headers }).pipe(
      catchError(err => {
        if (err?.status === 404 || err?.status === 405) {
          return this.http.post(this.baseUrl, data, { headers }); // fallback
        }
        return throwError(() => err);
      })
    );
  }

  /** Eliminar podcast del autor (best-effort con 2 rutas conocidas) */
  deletePodcast(id: string): Observable<any> {
    const headers = this.authHeaders();
    // 1) DELETE /podcast/:id
    return this.http.delete(`${this.baseUrl}/${id}`, { headers }).pipe(
      catchError(err => {
        if (err?.status === 404 || err?.status === 405) {
          // 2) DELETE /podcast/delete/:id (fallback)
          return this.http.delete(`${this.baseUrl}/delete/${id}`, { headers });
        }
        return throwError(() => err);
      })
    );
  }
}
