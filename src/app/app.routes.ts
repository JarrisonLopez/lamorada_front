import { Routes } from '@angular/router';

// Auth
import { SignInComponent } from './auth/sign-in/sign-in.component';
import { SignUpComponent } from './auth/sign-up/sign-up.component';

// Páginas base
import { HomeComponent } from './pages/home/home.component';
import { ProductComponent } from './pages/product/product.component';
import { PodcastComponent } from './pages/podcast/podcast.component';

// Posts
import { PostListComponent } from './pages/post/post-list.component';

// Carrito / Citas / Disponibilidad
import { CartComponent } from './pages/cart/cart.component';
import { AppointmentComponent } from './pages/appointment/appointment.component';
import { AvailabilityComponent } from './pages/availability/availability.component';          // público
import { AvailabilityManageComponent } from './pages/availability/availability-manage.component'; // gestión

// Perfil (lista de psicólogos) público
import { ProfileComponent } from './pages/profile/profile.component';

// Editar perfil (propio) — SOLO CLIENTE
import { ProfileEditComponent } from './pages/profile-edit/profile-edit.component';

// Métodos de pago
import { PaymentComponent } from './pages/payment/payment.component';

// Checkout
import { CheckoutComponent } from './pages/checkout/checkout.component';

// Guards
import { AuthRoleGuard } from './guards/auth-role.guard';
import { clientOnlyGuard } from './guards/client-only.guard';

export const routes: Routes = [
  { path: 'sign-in', component: SignInComponent },
  { path: 'sign-up', component: SignUpComponent },

  { path: 'home', component: HomeComponent },
  { path: 'product', component: ProductComponent },

  // Posts
  { path: 'post', component: PostListComponent }, // público

  { path: 'podcast', component: PodcastComponent },

  // Crear producto (lazy loaded)
  {
  path: 'product/create',
  loadComponent: () => import('./pages/product/product-create.component')
    .then(m => m.ProductCreateComponent),
  canActivate: [AuthRoleGuard],
  data: { expectedRoles: ['psychologist'] }
  },

  // Carrito / Citas (protegidas)
  {
    path: 'cart',
    component: CartComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] }
  },
  {
    path: 'appointment',
    component: AppointmentComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] }
  },

  // Disponibilidad
  { path: 'availability', component: AvailabilityComponent }, // pública
  {
    path: 'availability/manage',
    component: AvailabilityManageComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['psychologist'] }
  },

  // Perfil (público): lista todos los psicólogos
  { path: 'profile', component: ProfileComponent },

  // Editar perfil propio (protegida + SOLO CLIENTE)
  {
    path: 'profile/edit',
    component: ProfileEditComponent,
    canMatch: [clientOnlyGuard],  // <- evita SSR
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] }
  },
  // Métodos de pago (protegida + SOLO CLIENTE)
  {
    path: 'payment',
    component: PaymentComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] }
  },
  // Checkout (protegida + SOLO CLIENTE)
  {
    path: 'checkout',
    component: CheckoutComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] }
  },

  // Post Editor (lazy loaded)
  {
  path: 'post/editor',
  loadComponent: () => import('./pages/post/post-editor.component').then(m => m.PostEditorComponent),
  canActivate: [AuthRoleGuard],
  data: { expectedRoles: ['psychologist'] }
  },


  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
