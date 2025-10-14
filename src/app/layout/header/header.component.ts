import { Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthStateService } from '../../core/state/auth-state.service';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent {
  private userSvc = inject(UserService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private authState = inject(AuthStateService);

  isLogged = false;
  role: 'patient' | 'psychologist' | null = null;
  name: string | null = null;

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit() {
    // Suscripción reactiva: cualquier cambio de sesión actualiza el header
    this.authState.state$.subscribe((s) => {
      this.isLogged = s.isLogged;
      this.role = s.role;
      this.name = s.name;
    });

    // Estado inicial desde storage (sin golpear el backend)
    if (this.isBrowser) this.authState.refreshFromStorage();
  }

  async onLogout() {
    try { await this.userSvc.logout().toPromise(); } catch {}
    this.userSvc.clearToken();               // limpia storage + emite estado
    this.router.navigateByUrl('/sign-in');   // UI coherente
  }
}