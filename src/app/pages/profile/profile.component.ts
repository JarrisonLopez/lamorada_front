import { Component, signal, inject } from '@angular/core';
import { UserService } from '../../services/user.service';
import { FormBuilder, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  imports: [ReactiveFormsModule, CommonModule],
})
export class ProfileComponent {
  private platformId = inject(PLATFORM_ID);

  me = signal<any>(null);
  form!: FormGroup;

  constructor(private fb: FormBuilder, private user: UserService) {
    this.form = this.fb.group({ name: [''], phone: [''] });
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.me.set({ _id: payload.sub, name: payload.name, phone: payload.phone });
      this.form.patchValue({ name: payload.name || '', phone: payload.phone || '' });
    } catch {}
  }

  save() {
    const id = this.me()?.['_id'];
    if (!id) return;
    this.user.updateUser(id, this.form.value).subscribe();
  }

  deleteMe() {
    this.user.deleteMe().subscribe(() => {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.removeItem('token');
        window.location.href = '/home';
      }
    });
  }
}
