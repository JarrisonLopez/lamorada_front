import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export type AuthSnapshot = {
  isLogged: boolean;
  token: string | null;
  role: 'patient' | 'psychologist' | null;
  name: string | null;
};

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly stateSub = new BehaviorSubject<AuthSnapshot>({
    isLogged: false,
    token: null,
    role: null,
    name: null,
  });

  state$ = this.stateSub.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  private isBrowser() { return isPlatformBrowser(this.platformId); }

  /** Lee localStorage y emite el estado actual */
  refreshFromStorage() {
    if (!this.isBrowser()) return;
    let token: string | null = null;
    let role: any = null;
    let name: string | null = null;
    try {
      token = localStorage.getItem('token');
      role  = localStorage.getItem('role') as any;
      name  = localStorage.getItem('name');
    } catch {}
    this.stateSub.next({
      isLogged: !!token,
      token, role: (role as any) || null,
      name: name || null,
    });
  }

  /** Para notificar login/actualización */
  setAuth(partial: Partial<AuthSnapshot>) {
    const current = this.stateSub.getValue();
    const next: AuthSnapshot = {
      isLogged: partial.isLogged ?? current.isLogged,
      token: partial.token ?? current.token,
      role: (partial.role as any) ?? current.role,
      name: partial.name ?? current.name,
    };
    this.stateSub.next(next);
  }

  /** Para notificar logout */
  clear() {
    this.stateSub.next({ isLogged: false, token: null, role: null, name: null });
  }
}
