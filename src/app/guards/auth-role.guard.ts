import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

function getToken(platformId: Object): string | null {
  if (!isPlatformBrowser(platformId)) return null;
  try { return localStorage.getItem('token'); } catch { return null; }
}

function getRolesFromToken(token: string | null): string[] {
  if (!token) return [];
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const role = payload?.role || payload?.user_role || payload?.user?.role;
    return role ? [role] : [];
  } catch { return []; }
}

export const AuthRoleGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // En SSR, deja pasar para que renderice; el cliente re-evaluará y redirigirá si hace falta
  const token = getToken(platformId);
  if (!isPlatformBrowser(platformId)) return true;

  if (!token) {
    router.navigate(['/sign-in']);
    return false;
  }
  const expected = route.data?.['expectedRoles'] as string[] | undefined;
  const roles = getRolesFromToken(token);

  if (expected && expected.length && !expected.some(r => roles.includes(r))) {
    router.navigate(['/home']);
    return false;
  }
  return true;
};
