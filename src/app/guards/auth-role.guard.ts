import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { UserService } from '../services/user.service';

@Injectable({
  providedIn: 'root',
})
export class AuthRoleGuard implements CanActivate {
  constructor(private router: Router, private userService: UserService) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | Observable<boolean> | Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return false;
    }

    // Verificamos el rol requerido en las rutas
    const expectedRoles = route.data['roles'] as string[];
    const userData = this.decodeToken(token);

    if (!userData) {
      this.router.navigate(['/login']);
      return false;
    }

    // Si la ruta requiere roles específicos
    if (expectedRoles && !expectedRoles.includes(userData.role)) {
      this.router.navigate(['/unauthorized']);
      return false;
    }

    return true;
  }

  // Decodifica el payload del JWT sin necesidad de librerías externas
  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch {
      return null;
    }
  }
}