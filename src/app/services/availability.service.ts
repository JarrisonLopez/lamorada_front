import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { map, Observable } from 'rxjs';

export type AvSlot = { start: string; end: string };
export type AvailabilityDoc = { _id?: string; days: string[]; slots: AvSlot[] };

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app/availability';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private isBrowser() { return isPlatformBrowser(this.platformId); }

  private getAuthHeaders(): HttpHeaders {
    const token = this.isBrowser() ? localStorage.getItem('token') : null;
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  /** Crea/actualiza disponibilidad del psicólogo logueado */
  upsertAvailability(doc: AvailabilityDoc): Observable<AvailabilityDoc> {
    return this.http.post<AvailabilityDoc>(this.baseUrl, doc, { headers: this.getAuthHeaders() });
  }

  /** Devuelve la disponibilidad del psicólogo logueado (o null si no hay) */
  getAvailability(): Observable<AvailabilityDoc | null> {
    return this.http.get<any>(this.baseUrl, { headers: this.getAuthHeaders() }).pipe(
      map((r) => {
        // el back suele responder { success, availability } o directamente el doc
        if (r?.availability === null) return null;
        if (r?.availability) return r.availability as AvailabilityDoc;
        return (r as AvailabilityDoc) ?? null;
      })
    );
  }

  deleteAvailability(id: string) {
    return this.http.delete(this.baseUrl + '/' + encodeURIComponent(id), {
      headers: this.getAuthHeaders(),
    });
  }
}
