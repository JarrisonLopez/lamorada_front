import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

const SILENCE_USER_READ_ERR = (url: string) =>
  /\/user\/me\b/i.test(url) ||
  /\/user\/get-psychologists\b/i.test(url) ||
  /\/user\/get-patients\b/i.test(url);

export const errorInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const url = req.url || '';
      const msg = (err?.error?.message || err?.message || '').toString();

      // Silenciar errores esperables de endpoints de lectura de usuario durante bootstrap del perfil
      if (SILENCE_USER_READ_ERR(url) && [401, 403, 404, 405].includes(err.status)) {
        // console.warn('[silent user-read error]', err.status, url);
        return throwError(() => err);
      }

      // UX general
      if (err.status === 0) {
        alert('No se pudo conectar al servidor.');
      } else if (err.status === 401) {
        alert(msg || 'Tu sesión expiró o no estás autenticado. Inicia sesión.');
      } else if (err.status === 403) {
        alert(msg || 'No tienes permisos para esta acción.');
      } else if (err.status >= 500) {
        alert('Error del servidor. Intenta de nuevo más tarde.');
      } else if (msg) {
        alert(msg);
      }

      // eslint-disable-next-line no-console
      console.error('[HTTP ERROR]', err.status, url, err.error);
      return throwError(() => err);
    })
  );
