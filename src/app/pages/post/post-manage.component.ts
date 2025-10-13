import { Component, Inject, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { PostService } from '../../services/post.service';
import { UserService } from '../../services/user.service';
import { decodeJwt } from '../../core/utils/jwt';

type Post = {
  _id: string;
  psychologist_id: string | { _id: string; name?: string; last_name1?: string; last_name2?: string };
  title: string;
  content: string;
  active: boolean;
  created_at?: string | Date;
};

@Component({
  standalone: true,
  selector: 'app-post-manage',
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './post-manage.component.html',
  styleUrls: ['./post-manage.component.css'],
})
export class PostManageComponent {
  private platformId = inject(PLATFORM_ID);
  private svc = inject(PostService);
  private userSvc = inject(UserService);
  private fb = inject(FormBuilder);

  // estado
  loading = false;
  saving = false;
  err: string | null = null;
  msg: string | null = null;

  // lista
  posts: Post[] = [];

  // autor actual (del JWT)
  meId: string | null = null;

  // activar para ver los ids comparados
  debug = false;

  // formulario (FormBuilder ya está inyectado antes)
  form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    content: ['', [Validators.required, Validators.maxLength(5000)]],
    active: [true],
  });

  get isBrowser() { return isPlatformBrowser(this.platformId); }

  ngOnInit(): void {
    this.resolveMeId();
    if (this.isBrowser) this.fetch();
  }

  // ========= helpers de ID =========
  private normId(val: unknown): string | null {
    if (val == null) return null;
    const s = String(val).trim();
    return s.length ? s : null;
  }

  private extractIdFromJwt(token: string | null): string | null {
    if (!token) return null;
    try {
      const p: any = decodeJwt(token);
      return (
        this.normId(p?.sub) ||
        this.normId(p?._id) ||
        this.normId(p?.id) ||
        this.normId(p?.user_id) ||
        this.normId(p?.user?._id) ||
        this.normId(p?.user?.id) ||
        this.normId(p?.userId) ||
        null
      );
    } catch {
      return null;
    }
  }

  private resolveMeId() {
    if (!this.isBrowser) { this.meId = null; return; }
    const token = this.userSvc.getToken?.() ?? (localStorage.getItem('token') || null);
    this.meId = this.extractIdFromJwt(token);
  }

  ownerId(p: Post): string | null {
    if (typeof p.psychologist_id === 'string') {
      return this.normId(p.psychologist_id);
    }
    return this.normId((p.psychologist_id as any)?._id);
  }

  isOwner(p: Post): boolean {
    const owner = this.ownerId(p);
    return !!owner && !!this.meId && owner === String(this.meId);
  }

  // ========= data =========
  fetch() {
    this.loading = true;
    this.err = null;
    this.svc.getPosts()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: any) => {
          // el back puede devolver array directo o {posts:[...]}
          const list: Post[] = Array.isArray(res) ? res : (res?.posts ?? []);
          this.posts = list;
        },
        error: () => { this.err = 'No se pudieron cargar los artículos.'; },
      });
  }

  // ========= acciones =========
  create() {
    if (!this.isBrowser) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.saving = true;
    this.err = null;
    this.msg = null;

    const payload = {
      title: this.form.value.title as string,
      content: this.form.value.content as string,
      active: !!this.form.value.active,
    };

    this.svc.createPost(payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.msg = 'Artículo creado.';
          this.form.reset({ title: '', content: '', active: true });
          this.fetch();
        },
        error: (e) => {
          if (e?.status === 401) this.err = 'Tu sesión expiró o no estás autenticado.';
          else if (e?.status === 403) this.err = 'No tienes permisos para esta acción.';
          else this.err = e?.error?.message || 'No se pudo crear el artículo.';
        },
      });
  }

  toggleActive(p: Post) {
    if (!this.isOwner(p)) return;
    const next = !p.active;
    this.svc.updatePost(p._id, { active: next })
      .subscribe({
        next: () => {
          p.active = next;
          this.msg = next ? 'Artículo activado.' : 'Artículo desactivado.';
        },
        error: (e) => {
          if (e?.status === 401) this.err = 'No autorizado. Inicia sesión de nuevo.';
          else if (e?.status === 403) this.err = 'No puedes modificar este artículo.';
          else this.err = e?.error?.message || 'No se pudo actualizar el artículo.';
        },
      });
  }

  remove(p: Post) {
    if (!this.isOwner(p)) return;
    if (this.isBrowser && !confirm('¿Eliminar este artículo?')) return;

    this.svc.deletePost(p._id)
      .subscribe({
        next: () => {
          this.posts = this.posts.filter(x => x._id !== p._id);
          this.msg = 'Artículo eliminado.';
        },
        error: (e) => {
          if (e?.status === 401) this.err = 'No autorizado. Inicia sesión de nuevo.';
          else if (e?.status === 403) this.err = 'No puedes eliminar este artículo.';
          else this.err = e?.error?.message || 'No se pudo eliminar el artículo.';
        },
      });
  }
}
