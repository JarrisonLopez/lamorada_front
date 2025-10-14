import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap } from 'rxjs';

// Rutas de auth que NO deben llevar Authorization
const AUTH_SKIP = [
  /\/auth\/login\b/i,
  /\/user\/login\b/i,
  /\/auth\/sign-?in\b/i,
  /\/user\/sign-?in\b/i,
  /\/sign-?in\b/i,
];
const shouldSkipAuth = (url: string) => AUTH_SKIP.some(re => re.test(url));

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  const platformId = inject(PLATFORM_ID);
  let cloned = req;

  // Añadir Authorization solo en navegador y si no es una ruta excluida
  if (isPlatformBrowser(platformId) && !shouldSkipAuth(req.url)) {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        cloned = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
      }
    } catch {
      /* noop */
    }
  }

  return next(cloned).pipe(
    tap((event: HttpEvent<any>) => {
      // Capturar x-new-token solo en respuestas (HttpResponse) y solo en navegador
      if (isPlatformBrowser(platformId) && event instanceof HttpResponse) {
        try {
          const newToken = event.headers.get('x-new-token');
          if (newToken) {
            localStorage.setItem('token', newToken);
          }
        } catch {
          /* noop */
        }
      }
    })
  );
};
