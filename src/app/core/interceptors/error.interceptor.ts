// src/app/core/interceptors/error.interceptor.ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (_req, next) =>
  next(_req).pipe(
    catchError((err: HttpErrorResponse) => {
      // No limpiar localStorage aquí.
      return throwError(() => err);
    })
  );
