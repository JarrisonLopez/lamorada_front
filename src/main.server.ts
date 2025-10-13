import 'zone.js/node';

import { bootstrapApplication } from '@angular/platform-browser';
import { provideServerRendering } from '@angular/platform-server';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';

// 👇 añade withFetch
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';

import { AppComponent } from './app/app';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';

export default function bootstrap(context: unknown) {
  return bootstrapApplication(
    AppComponent,
    {
      providers: [
        provideServerRendering(),
        provideRouter(routes),
        // 👇 activa fetch también en SSR
        provideHttpClient(
          withFetch(),
          withInterceptors([authInterceptor, errorInterceptor])
        ),
      ],
    },
    context as any
  );
}
