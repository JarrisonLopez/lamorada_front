import { Component } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormGroup,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../services/user.service';

// Política del backend (NO acepta ".", sí un símbolo de @$!%*?&)
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Validador para confirmar contraseña (UI)
function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const p = (group.get('password')?.value ?? '').toString().trim();
  const c = (group.get('confirmPassword')?.value ?? '').toString().trim();
  return p === c ? null : { passwordsMismatch: true };
}

// ID del usuario
const USER_ID_REGEX = /^[A-Za-z0-9._-]{5,30}$/;
// Teléfono local sencillo: 7–15 dígitos
const PHONE_REGEX = /^[0-9]{7,15}$/;

@Component({
  standalone: true,
  selector: 'app-sign-up',
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css'],
  imports: [ReactiveFormsModule, CommonModule],
})
export class SignUpComponent {
  form!: FormGroup;
  loading = false;
  msg: string | null = null;
  error: string | null = null;

  // ---- Logo con fallback automático ----
  logoUrl = 'assets/lamorada-logo.png'; // pon tu archivo aquí: src/assets/lamorada-logo.png
  private readonly fallbackSvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="#c084fc"/>
            <stop offset="1" stop-color="#8f6bff"/>
          </linearGradient>
        </defs>
        <rect rx="14" ry="14" width="64" height="64" fill="white"/>
        <g transform="translate(6 6)">
          <path d="M2 24 26 4l24 20v22a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V24z" fill="url(#g)" opacity="0.18"/>
          <path d="M26 4 2 24v22a4 4 0 0 0 4 4h40a4 4 0 0 0 4-4V24L26 4z"
                fill="none" stroke="url(#g)" stroke-width="3" stroke-linejoin="round"/>
          <path d="M26 32c-5-4-8-7-8-10a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 3-3 6-8 10z"
                fill="url(#g)"/>
          <rect x="22" y="36" width="8" height="8" rx="2" fill="url(#g)"/>
        </g>
      </svg>
    `);

  onLogoError() {
    this.logoUrl = this.fallbackSvg; // si falla el PNG, mostramos el SVG de respaldo
  }

  pwVisible = false;
  cpwVisible = false;

  documentTypes = [
    { value: 'CC', label: 'Cédula de ciudadanía' },
    { value: 'CE', label: 'Cédula de extranjería' },
    { value: 'PAS', label: 'Pasaporte' },
  ];

  constructor(private fb: FormBuilder, private user: UserService, private router: Router) {
    this.form = this.fb.group(
      {
        _id: ['', [Validators.required, Validators.pattern(USER_ID_REGEX)]],
        document_type: ['', Validators.required],
        name: ['', [Validators.required, Validators.minLength(2)]],
        last_name1: ['', [Validators.required, Validators.minLength(2)]],
        last_name2: ['', [Validators.required, Validators.minLength(2)]],
        age: [null, [Validators.required, Validators.min(1), Validators.max(120)]],
        phone: ['', [Validators.required, Validators.pattern(PHONE_REGEX)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.pattern(PASSWORD_POLICY)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordsMatchValidator }
    );
  }

  // Helpers
  get f() {
    return this.form.controls;
  }
  get confirm() {
    return this.form.get('confirmPassword')!;
  }

  get passwordStrength(): { score: number; label: string } {
    const v: string = (this.f['password']?.value ?? '').toString();
    if (!v) return { score: 0, label: '–' };
    let score = 0;
    if (v.length >= 8) score += 25;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score += 25;
    if (/\d/.test(v)) score += 25;
    if (/[@$!%*?&]/.test(v)) score += 25;
    const label =
      score >= 90 ? 'Fuerte' : score >= 60 ? 'Media' : score >= 30 ? 'Débil' : 'Muy débil';
    return { score, label };
  }

  get passwordErrors(): string | null {
    const c = this.f['password'];
    if (!c || !c.touched) return null;
    if (c.hasError('required')) return 'La contraseña es obligatoria.';
    if (c.hasError('pattern')) {
      return 'Debe tener 8+ caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 símbolo de @$!%*?&.';
    }
    return null;
  }

  togglePw() {
    this.pwVisible = !this.pwVisible;
  }
  toggleCpw() {
    this.cpwVisible = !this.cpwVisible;
  }

  private extractMsg(obj: any): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (obj.message) return String(obj.message);
    if (Array.isArray(obj.errors))
      return obj.errors.map((x: any) => x?.msg || x?.message).join(' • ');
    try {
      return JSON.stringify(obj);
    } catch {
      return '';
    }
  }

  private translateBackendMessage(msg: string): string {
    const m = (msg || '').toUpperCase();
    if (m.includes('PASSWORD_MISMATCH')) return 'Las contraseñas no coinciden.';
    if (m.includes('EMAIL EXISTS')) return 'Ese correo ya está registrado.';
    if (m.includes('INVALID EMAIL')) return 'Correo inválido.';
    if (m.includes('INVALID PASSWORD')) {
      return 'La contraseña no cumple la política: 8+ caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 símbolo de @$!%*?&.';
    }
    if (m.includes('INVALID ID') || m.includes('ID INVALID')) return 'ID inválido.';
    if (m.includes('ID EXISTS')) return 'El ID ya existe.';
    if (m.includes('INVALID PARAMS')) return 'Revisa los campos obligatorios.';
    return msg || 'No pude completar el registro.';
  }

  async submit() {
    this.msg = null;
    this.error = null;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading = true;

    const payload = {
      _id: (this.f['_id'].value ?? '').toString().trim(),
      document_type: this.f['document_type'].value,
      name: (this.f['name'].value ?? '').toString().trim(),
      last_name1: (this.f['last_name1'].value ?? '').toString().trim(),
      last_name2: (this.f['last_name2'].value ?? '').toString().trim(),
      age: Number(this.f['age'].value),
      phone: (this.f['phone'].value ?? '').toString().trim(),
      email: (this.f['email'].value ?? '').toString().trim(),
      password: (this.f['password'].value ?? '').toString().trim(),
      rePassword: (this.f['confirmPassword'].value ?? '').toString().trim(),
    };

    try {
      const resp = await firstValueFrom(this.user.register(payload));
      const msg = this.extractMsg(resp);
      if (resp && resp.success === false) {
        this.error = this.translateBackendMessage(msg);
        this.loading = false;
        return;
      }
      this.msg = 'Cuenta creada. Ingresa ahora.';
      this.loading = false;
      this.router.navigate(['/sign-in']);
    } catch (e: any) {
      const msg = this.extractMsg(e?.error);
      this.error = this.translateBackendMessage(msg);
      this.loading = false;
    }
  }
}
