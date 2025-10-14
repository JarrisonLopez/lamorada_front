import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgIf, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, FormControl } from '@angular/forms';
import { UserService } from '../../services/user.service';

type Role = 'patient' | 'psychologist' | 'unknown';

type MeForm = FormGroup<{
  name: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  age: FormControl<number | null>;
  specialty: FormControl<string | null>;
}>;

@Component({
  standalone: true,
  selector: 'app-profile-edit',
  imports: [CommonModule, ReactiveFormsModule, NgIf],
  templateUrl: './profile-edit.component.html',
  styleUrls: ['./profile-edit.component.css'],
})
export class ProfileEditComponent {
  constructor(
    private fb: FormBuilder,
    private userSrv: UserService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.form = this.fb.group({
      name: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
      email: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
      phone: this.fb.control<string>('', { nonNullable: true }),
      age: this.fb.control<number | null>(null),
      specialty: this.fb.control<string | null>(null), // solo visible si role=psychologist
    });
  }

  form!: MeForm;
  loading = true;
  saving  = false;
  role: Role = 'unknown';

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit() {
    // Derivamos rol de storage/JWT sin pegarle al back (UserService ya es SSR-safe)
    const r = (this.userSrv.getRole() || '').toString();
    this.role = (r === 'patient' || r === 'psychologist') ? r : 'unknown';

    if (!this.isBrowser) { this.loading = false; return; }

    // Carga del perfil
    this.userSrv.getMe().subscribe({
      next: (me: any) => {
        // Campos defensivos: tomamos lo que haya
        this.form.patchValue({
          name: (me?.name ?? '') as string,
          email: (me?.email ?? '') as string,
          phone: (me?.phone ?? '') as string,
          age: (Number(me?.age) || null),
          specialty: (me?.specialty ?? me?.speciality ?? null),
        });

        // Si el back no quiere cambiar email, puedes deshabilitarlo:
        // this.form.controls.email.disable();
      },
      error: (err) => {
        console.error('[profile-edit] /user/me error:', err);
        alert('No se pudo cargar tu perfil.');
      },
      complete: () => this.loading = false
    });
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    // Construimos payload sólo con lo que tenga valor (evita sobreescrituras con null/undefined)
    const raw = this.form.getRawValue();
    const data: any = {
      name: raw.name?.trim(),
      email: raw.email?.trim(),
      phone: raw.phone?.trim(),
    };
    if (raw.age != null && raw.age !== ('' as any)) data.age = Number(raw.age);
    // specialty sólo si el rol lo usa
    if (this.role === 'psychologist') {
      data.specialty = (raw.specialty ?? '').toString().trim();
    }

    this.saving = true;
    this.userSrv.updateMe(data).subscribe({
      next: (r) => {
        // Sincroniza nombre en el header si cambió
        if (data.name) this.userSrv.setName(data.name);
        alert('Perfil actualizado ✅');
      },
      error: (err) => {
        console.error('[profile-edit] PUT /user/me error:', err);
        const msg = (err?.error?.message || err?.message || '').toString();
        alert(msg || 'No se pudo actualizar el perfil.');
      },
      complete: () => this.saving = false
    });
  }
}
