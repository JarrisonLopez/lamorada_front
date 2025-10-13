import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // prerender opcional para páginas públicas:
  { path: '',        renderMode: RenderMode.Prerender },
  { path: 'home',    renderMode: RenderMode.Prerender },
  { path: 'sign-in', renderMode: RenderMode.Prerender },
  { path: 'sign-up', renderMode: RenderMode.Prerender },

  // fallback para TODO lo demás (appointment, cart, etc.)
  { path: '**', renderMode: RenderMode.Server },
];
