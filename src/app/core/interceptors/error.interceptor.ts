import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const msg = (err?.error?.message || err?.message || '').toString();
      if (err.status === 401) alert(msg || 'Tu sesión expiró o no estás autenticado. Inicia sesión.');
      else if (err.status === 403) alert(msg || 'No tienes permisos para esta acción.');
      else if (err.status === 0) alert('No se pudo conectar al servidor.');
      else if (msg) alert(msg);
      // eslint-disable-next-line no-console
      console.error('[HTTP ERROR]', err.status, err.url, err.error);
      return throwError(() => err);
    })
  );
