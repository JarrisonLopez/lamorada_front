import 'zone.js';

import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';

// 👇 añade withFetch
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';

import { AppComponent } from './app/app';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    // 👇 activa fetch en HttpClient + tus interceptores
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, errorInterceptor])
    ),
  ],
}).catch(console.error);
