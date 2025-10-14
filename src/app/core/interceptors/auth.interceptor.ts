import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap } from 'rxjs';

// rutas de auth que NO deben llevar Authorization
const AUTH_SKIP = [/\/auth\/login\b/i, /\/user\/login\b/i, /\/auth\/sign-?in\b/i, /\/user\/sign-?in\b/i, /\/sign-?in\b/i];
function shouldSkipAuth(url: string) { return AUTH_SKIP.some((re) => re.test(url)); }

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  const platformId = inject(PLATFORM_ID);
  let cloned = req;

  if (isPlatformBrowser(platformId) && !shouldSkipAuth(req.url)) {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        cloned = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
        // DEBUG: muestra que sí se adjuntó el header (solo en dev)
        if (!('production' in window)) {
          // eslint-disable-next-line no-console
          console.debug('[authInterceptor] Authorization añadido a', req.url);
        }
      }
    } catch { /* noop */ }
  }

  return next(cloned).pipe(
    tap((event: any) => {
      if (isPlatformBrowser(platformId)) {
        try {
          const newToken = event?.headers?.get?.('x-new-token');
          if (newToken) localStorage.setItem('token', newToken);
        } catch { /* noop */ }
      }
    })
  );
};
