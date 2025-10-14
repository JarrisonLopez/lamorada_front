import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { catchError, map, Observable, of, switchMap, throwError } from 'rxjs';
import { AvailabilityDoc } from '../models/availability.model';
import { EN2ES_PLAIN } from '../shared/day-utils';

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private baseUrl = 'https://la-morada-back-production.up.railway.app/availability';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  private isBrowser() { return isPlatformBrowser(this.platformId); }
  private headers(): HttpHeaders {
    const token = this.isBrowser() ? localStorage.getItem('token') : null;
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  /** POST /availability — intenta EN; si el back dice "Día inválido", reintenta en ES plano */
  upsertAvailability(doc: AvailabilityDoc): Observable<AvailabilityDoc> {
    const tryEN$ = this.http.post<any>(this.baseUrl, doc, { headers: this.headers() });

    return tryEN$.pipe(
      map(r => (r?.availability ?? r) as AvailabilityDoc),
      catchError((err: HttpErrorResponse) => {
        const msg = (err?.error?.message || '').toString().toLowerCase();
        const isDayInvalid = err.status === 400 && /dia invalido|día inválido|dia invalido/i.test(msg);
        if (!isDayInvalid) return throwError(() => err);

        // Reintento: transformamos días EN -> ES (sin tildes)
        const esDoc: AvailabilityDoc = {
          ...doc,
          days: (doc.days || []).map(d => EN2ES_PLAIN[d] ?? d),
        };

        // eslint-disable-next-line no-console
        console.warn('[availability] reintentando con días ES:', esDoc.days);

        return this.http.post<any>(this.baseUrl, esDoc, { headers: this.headers() }).pipe(
          map(r => (r?.availability ?? r) as AvailabilityDoc),
          // si también falla, devolvemos el error original para no confundir
          catchError(() => throwError(() => err))
        );
      })
    );
  }

  /** GET /availability — devuelve doc o null, tolera { success, availability } */
  getAvailability(): Observable<AvailabilityDoc | null> {
    return this.http.get<any>(this.baseUrl, { headers: this.headers() }).pipe(
      map((r) => {
        if (r?.availability === null) return null;
        if (r?.availability) return r.availability as AvailabilityDoc;
        return (r as AvailabilityDoc) ?? null;
      })
    );
  }

  /** DELETE /availability/:id */
  deleteAvailability(id: string) {
    return this.http.delete(this.baseUrl + '/' + encodeURIComponent(id), {
      headers: this.headers(),
    });
  }
}
