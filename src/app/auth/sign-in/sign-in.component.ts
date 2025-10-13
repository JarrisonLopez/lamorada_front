import { Component, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { UserService } from '../../services/user.service';
import { decodeJwt } from '../../core/utils/jwt';

@Component({
  standalone: true,
  selector: 'app-sign-in',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css'],
})
export class SignInComponent {
  form: FormGroup;
  loading = false;
  err: string | null = null;

  constructor(
    private fb: FormBuilder,
    private userSvc: UserService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  private get isBrowser() { return isPlatformBrowser(this.platformId); }

  async onSubmit() {
    if (this.form.invalid || !this.isBrowser) return;
    this.loading = true; this.err = null;

    try {
      const resp = await firstValueFrom(this.userSvc.login(this.form.value.email, this.form.value.password));
      const token: string | undefined = resp?.token;
      if (!token) { this.err = 'El servidor no devolvió token.'; this.loading = false; return; }

      this.userSvc.setToken(token);

      try {
        const p: any = decodeJwt(token);
        const role = p?.role || p?.user?.role || null;
        const name = p?.name || p?.user?.name || null;
        if (role) this.userSvc.setRole(role);
        if (name) this.userSvc.setName(name);
      } catch {}

      if (!this.userSvc.getRole()) {
        try {
          const me = await firstValueFrom(this.userSvc.getMe());
          if (me?.role) this.userSvc.setRole(me.role);
          if (me?.name) this.userSvc.setName(me.name);
        } catch {}
      }

      this.router.navigateByUrl('/home');
    } catch (e: any) {
      this.err = e?.status === 401 ? 'Credenciales inválidas.' : (e?.error?.message || 'No se pudo iniciar sesión.');
    } finally {
      this.loading = false;
    }
  }
}
