import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Post {
  _id: string;
  psychologist_id: string | { _id: string };
  title: string;
  content: string;
  active: boolean;
  created_at?: string | Date;
}

export interface CreatePostDto {
  title: string;
  content: string;
  active?: boolean;
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly baseUrl = 'https://la-morada-back-production.up.railway.app/post';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  // ───── helpers
  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try { return localStorage.getItem('token'); } catch { return null; }
  }

  private authHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  /** Extrae múltiples claves posibles del JWT para el id de usuario */
  getUserIdFromToken(): string | null {
    const t = this.getToken();
    if (!t) return null;
    try {
      const p = JSON.parse(atob(t.split('.')[1] || ''));
      const id =
        p?.sub || p?._id || p?.id || p?.user_id ||
        p?.user?._id || p?.user?.id || p?.userId || null;
      return id ? String(id) : null;
    } catch {
      return null;
    }
  }

  // ───── endpoints
  createPost(data: CreatePostDto): Observable<Post> {
    return this.http.post<Post>(`${this.baseUrl}/create`, data, { headers: this.authHeaders() });
  }

  getPosts(): Observable<Post[] | any> {
    return this.http.get<Post[] | any>(this.baseUrl, { headers: this.authHeaders() });
  }

  getPostById(id: string): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/${id}`, { headers: this.authHeaders() });
  }

  /** PUT con user_id/psychologist_id + fallback si la ruta difiere */
  updatePost(id: string, data: UpdatePostDto): Observable<Post> {
    const headers = this.authHeaders();
    const user_id = this.getUserIdFromToken();
    const body: any = { ...data, ...(user_id ? { user_id, psychologist_id: user_id } : {}) };

    return this.http.put<Post>(`${this.baseUrl}/${id}`, body, { headers }).pipe(
      catchError(err => {
        if (err?.status === 404 || err?.status === 405) {
          // Algunos back usan POST /post/update
          return this.http.post<Post>(`${this.baseUrl}/update`, { post_id: id, ...body }, { headers });
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * DELETE con body + query (cubrimos todas las variantes de ese back),
   * y fallback POST /post/delete si DELETE no existe.
   */
  deletePost(id: string): Observable<Post> {
    const headers = this.authHeaders();
    const user_id = this.getUserIdFromToken();
    const qs = user_id ? `?user_id=${encodeURIComponent(user_id)}` : '';

    return this.http.request<Post>('DELETE', `${this.baseUrl}/${id}${qs}`, {
      headers,
      body: user_id ? { user_id, psychologist_id: user_id } : {},
    }).pipe(
      catchError(err => {
        if (err?.status === 404 || err?.status === 405) {
          return this.http.post<Post>(
            `${this.baseUrl}/delete`,
            { post_id: id, user_id, psychologist_id: user_id },
            { headers }
          );
        }
        return throwError(() => err);
      })
    );
  }
}
