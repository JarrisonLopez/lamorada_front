import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgIf, NgFor, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormControl } from '@angular/forms';
import { UserService, Psychologist } from '../../services/user.service';

type CardPsy = Psychologist & {
  fullName: string;
  specialty?: string;
  phone?: string;
};

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [CommonModule, NgIf, NgFor, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent {
  loading = true;
  errorMsg: string | null = null;

  all: CardPsy[] = [];
  view: CardPsy[] = [];
  filterCtrl!: FormControl<string>;

  constructor(
    private userSrv: UserService,
    private fb: FormBuilder,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.filterCtrl = this.fb.control<string>('', { nonNullable: true });
  }

  get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    this.fetch();
    this.filterCtrl.valueChanges.subscribe(() => this.applyFilter());
  }

  public fetch() {
    this.loading = true;
    this.errorMsg = null;

    this.userSrv.getPsychologists().subscribe({
      next: ({ list, error }) => {
        if (error) {
          this.errorMsg = 'No se pudieron cargar los psicólogos.';
          this.all = [];
          this.view = [];
          this.loading = false;
          return;
        }

        const mapped: CardPsy[] = (list || []).map((u: any) => {
          const fullName =
            [u?.name, u?.last_name1, u?.last_name2].filter(Boolean).join(' ') ||
            u?.name ||
            u?.email ||
            u?._id;

          const specialty = u?.specialty ?? u?.speciality ?? '';
          const phone = u?.phone ?? '';

          return {
            _id: String(u?._id),
            name: u?.name,
            email: u?.email,
            fullName,
            specialty,
            phone,
          };
        });

        mapped.sort((a, b) => a.fullName.localeCompare(b.fullName));
        this.all = mapped;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('[profile] getPsychologists error:', err);
        this.errorMsg = 'No se pudieron cargar los psicólogos.';
        this.all = [];
        this.view = [];
        this.loading = false;
      },
    });
  }

  private applyFilter() {
    const q = (this.filterCtrl.value || '').trim().toLowerCase();
    if (!q) {
      this.view = [...this.all];
      return;
    }
    this.view = this.all.filter(
      (p) =>
        p.fullName?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        (p.specialty ?? '').toLowerCase().includes(q)
    );
  }

  initials(p: CardPsy): string {
    const base = p.fullName || p.email || p._id || '';
    const parts = base.trim().split(/\s+/).slice(0, 2);
    return parts.map((s) => s[0]?.toUpperCase() ?? '').join('');
  }

  async copyToClipboard(text?: string | null) {
    const t = (text || '').trim();
    if (!t) return;
    try {
      if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(t);
      else {
        const ta = document.createElement('textarea');
        ta.value = t;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (e) {
      console.warn('No se pudo copiar', e);
    }
  }
}
