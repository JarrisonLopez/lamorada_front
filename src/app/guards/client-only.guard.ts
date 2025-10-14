import { CanMatchFn, Route, UrlSegment } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Evita que una ruta haga match en SSR. Solo permite match en el navegador.
 */
export const clientOnlyGuard: CanMatchFn = (route: Route, segments: UrlSegment[]) => {
  const platformId = inject(PLATFORM_ID);
  return isPlatformBrowser(platformId);
};
