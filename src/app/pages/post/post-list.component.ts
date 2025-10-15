import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { PostService, Post } from '../../services/post.service';

@Component({
  standalone: true,
  selector: 'app-post-list',
  imports: [CommonModule, DatePipe],
  templateUrl: './post-list.component.html',
  styleUrls: ['./post-list.component.css'],
})
export class PostListComponent {
  loading = false;
  err: string | null = null;
  posts: Post[] = [];

  // búsqueda simple sin FormsModule
  q = '';

  constructor(private svc: PostService, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.fetch();
  }

  fetch() {
    this.loading = true;
    this.err = null;

    this.svc
      .getPosts(false)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: Post[]) => {
          const all = Array.isArray(res) ? res : [];
          // mantén también las inactivas: las mostramos con “píldora inactiva”
          this.posts = all.slice().sort((a, b) => {
            const da = new Date(a?.created_at as any).getTime() || 0;
            const db = new Date(b?.created_at as any).getTime() || 0;
            return db - da;
          });
        },
        error: (e: any) => {
          this.err = e?.error?.message || e?.message || 'No se pudieron cargar los artículos.';
        },
      });
  }

  /** posts filtrados por el query */
  get filtered(): Post[] {
    const q = (this.q || '').trim().toLowerCase();
    if (!q) return this.posts;
    return this.posts.filter((p) => {
      const t = (p.title || '').toLowerCase();
      const c = (p.content || '').toLowerCase();
      const a = this.authorName(p).toLowerCase();
      return t.includes(q) || c.includes(q) || a.includes(q);
    });
  }

  authorName(p: Post): string {
    const a: any = p?.psychologist_id;
    if (a && typeof a === 'object') {
      return [a.name, a.last_name1, a.last_name2].filter(Boolean).join(' ');
    }
    return '';
  }

  authorInitials(p: Post): string {
    const name = this.authorName(p) || p?.title || '';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((s) => s.charAt(0).toUpperCase()).join('') || 'LM';
  }

  isInactive(p: Post) {
    return p.active === false;
  }

  excerpt(n: number, text: string | undefined | null): string {
    if (!text) return '';
    const t = String(text).replace(/\s+/g, ' ').trim();
    return t.length <= n ? t : t.slice(0, n).trimEnd() + '…';
  }
}
