import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Post {
  _id: string;
  psychologist_id:
    | string
    | { _id: string; name?: string; last_name1?: string; last_name2?: string };
  title: string;
  content: string;
  active: boolean;
  created_at?: string | Date;
}

export interface CreatePostDto { title: string; content: string; active?: boolean; }
export interface UpdatePostDto { title?: string; content?: string; active?: boolean; }

function coerceArray<T = any>(res: any): T[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.posts)) return res.posts;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly baseUrl = 'https://la-morada-back-production.up.railway.app/post';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  // ───── SSR-safe helpers
  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try { return localStorage.getItem('token'); } catch { return null; }
  }

  private decodeJwt<T = any>(token: string | null): T | null {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      // @ts-ignore
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch { return null; }
  }

  private authHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  /** Nombre legible del usuario a partir del JWT (si existe) */
  getNameFromToken(): string | null {
    const p: any = this.decodeJwt(this.getToken());
    const nameParts = [
      p?.name, p?.last_name1, p?.last_name2,
      p?.user?.name, p?.user?.last_name1, p?.user?.last_name2
    ].filter(Boolean);
    if (nameParts.length) return nameParts.join(' ');
    return p?.user?.fullName ?? p?.fullName ?? null;
  }

  getRoleFromToken(): string | null {
    const p: any = this.decodeJwt(this.getToken());
    return p?.role ?? p?.user?.role ?? null;
  }

  getUserIdFromToken(): string | null {
    const p: any = this.decodeJwt(this.getToken());
    const id = p?.user_id ?? p?._id ?? p?.id ?? p?.sub ?? p?.user?.id ?? p?.user?._id ?? p?.userId ?? null;
    return id ? String(id) : null;
  }

  // ───── endpoints
  /** Mapea { success, post } o el post directo */
  createPost(data: CreatePostDto): Observable<Post> {
    return this.http.post<any>(`${this.baseUrl}/create`, data, { headers: this.authHeaders() })
      .pipe(map(res => (res?.post ?? res) as Post));
  }

  /** GET /post (?all=1) + cache buster para evitar respuestas cacheadas */
  getPosts(all = false): Observable<Post[]> {
    const sep = all ? '?all=1&' : '?';
    const url = `${this.baseUrl}${sep}_=${Date.now()}`;
    return this.http.get<any>(url).pipe(map(res => coerceArray<Post>(res)));
  }

  updatePost(id: string, data: UpdatePostDto): Observable<Post> {
    return this.http.put<Post>(`${this.baseUrl}/${id}`, data).pipe(
      catchError(err => {
        if (err?.status === 404 || err?.status === 405) {
          return this.http.post<Post>(`${this.baseUrl}/update`, { post_id: id, ...data });
        }
        return throwError(() => err);
      })
    );
  }

  deletePost(id: string): Observable<Post> {
    return this.http.delete<Post>(`${this.baseUrl}/${id}`).pipe(
      catchError(err => {
        if (err?.status === 404 || err?.status === 405) {
          return this.http.post<Post>(`${this.baseUrl}/delete`, { post_id: id });
        }
        return throwError(() => err);
      })
    );
  }
}
