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
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return new HttpHeaders(headers);
  }

  /** Lista de podcasts (el back devuelve { success, podcasts }) */
  getPodcasts(): Observable<any[]> {
    return this.http.get<any>(this.baseUrl).pipe(
      map(r => {
        const list = Array.isArray(r) ? r : (r?.podcasts ?? []);
        return Array.isArray(list) ? list : [];
      })
    );
  }

  /** Crear podcast: prioriza POST /podcast; fallback a /podcast/create si 404/405 */
  createPodcast(data: CreatePodcastDto): Observable<any> {
    const headers = this.authHeaders();
    return this.http.post(`${this.baseUrl}`, data, { headers }).pipe(
      catchError(err => {
        if (err?.status === 404 || err?.status === 405) {
          return this.http.post(`${this.baseUrl}/create`, data, { headers });
        }
        return throwError(() => err);
      })
    );
  }
}
