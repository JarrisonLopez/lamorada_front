import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { PostApiService, PostDto } from '../../services/post-api.service';
import { UserService } from '../../services/user.service';
import { decodeJwt } from '../../core/utils/jwt';

type Post = {
  _id: string;
  title: string;
  content: string;
  active?: boolean;
  psychologist_id?: string | { _id: string };
  created_at?: string | Date;
};

@Component({
  standalone: true,
  selector: 'app-post-editor',
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './post-editor.component.html',
  styleUrls: ['./post-editor.component.css'],
})
export class PostEditorComponent {
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private svc = inject(PostApiService);
  private userSvc = inject(UserService);

  isBrowser = isPlatformBrowser(this.platformId);
  loading = signal(false);
  saving = signal(false);
  err = signal<string | null>(null);
  msg = signal<string | null>(null);

  meId: string | null = null;
  myPosts = signal<Post[]>([]);

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    content: ['', [Validators.required, Validators.minLength(10)]],
    active: [true],
  });

  constructor() {
    if (this.isBrowser) {
      this.resolveIdentity();
      this.fetchMine();
    }
  }

  private resolveIdentity() {
    try {
      const t = this.userSvc.getToken();
      if (!t) return;
      const p: any = decodeJwt(t);
      const role = p?.role || p?.user?.role;
      const id = p?.user_id || p?.id || p?._id || p?.user?._id || p?.user?.id;
      if (role !== 'psychologist') this.err.set('Debes ser psicólogo para crear publicaciones.');
      if (id) this.meId = String(id);
    } catch {}
  }

  private isMine(post: Post): boolean {
    const pid = post?.psychologist_id;
    const asString = typeof pid === 'string' ? pid : (pid && (pid as any)._id);
    return !!(this.meId && asString && String(asString) === this.meId);
  }

  fetchMine() {
    if (!this.isBrowser) return;
    this.loading.set(true);
    this.err.set(null);
    this.svc.getAllRawAuth()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: posts => {
          const list = (Array.isArray(posts) ? posts : []) as Post[];
          this.myPosts.set(list.filter(p => this.isMine(p)));
        },
        error: () => this.err.set('No se pudieron cargar tus publicaciones.')
      });
  }

  create() {
    if (!this.isBrowser) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.err.set(null);
    this.msg.set(null);

    const dto: PostDto = {
      title: this.form.value.title!,
      content: this.form.value.content!,
      active: !!this.form.value.active,
    };

    this.svc.create(dto)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.msg.set('Publicación creada.');
          this.form.reset({ title: '', content: '', active: true });
          this.fetchMine();
        },
        error: (e) => {
          if (e?.status === 401) this.err.set('Tu sesión expiró o no estás autenticado.');
          else if (e?.status === 403) this.err.set('No tienes permisos para esta acción.');
          else if (e?.status === 404) this.err.set('Endpoint de creación no encontrado.');
          else this.err.set(e?.error?.message || 'No se pudo crear la publicación.');
        }
      });
  }

  remove(p: Post) {
    if (!this.isMine(p)) return;
    if (!confirm(`¿Eliminar "${p.title}"?`)) return;

    this.loading.set(true);
    this.err.set(null);
    this.msg.set(null);

    this.svc.remove(p._id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.msg.set('Publicación eliminada.');
          this.fetchMine();
        },
        error: (e) => {
          if (e?.status === 401) this.err.set('No autenticado.');
          else if (e?.status === 403) this.err.set('No autorizado (solo el autor puede eliminarla).');
          else this.err.set(e?.error?.message || 'No se pudo eliminar.');
        }
      });
  }
}
