import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
) => next(req).pipe(
  catchError((err: HttpErrorResponse) => {
    // Aquí podrías emitir un snackbar/toast global
    return throwError(() => err);
  })
);
