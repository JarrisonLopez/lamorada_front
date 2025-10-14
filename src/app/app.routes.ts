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
import { PostManageComponent } from './pages/post/post-manage.component';

// Carrito / Citas / Disponibilidad
import { CartComponent } from './pages/cart/cart.component';
import { AppointmentComponent } from './pages/appointment/appointment.component';
import { AvailabilityComponent } from './pages/availability/availability.component';
import { AvailabilityManageComponent } from './pages/availability/availability-manage.component';

// Perfil (lista de psicólogos)
import { ProfileComponent } from './pages/profile/profile.component';

// Editar perfil (propio)
import { ProfileEditComponent } from './pages/profile-edit/profile-edit.component';

// Guard
import { AuthRoleGuard } from './guards/auth-role.guard';

export const routes: Routes = [
  { path: 'sign-in', component: SignInComponent },
  { path: 'sign-up', component: SignUpComponent },

  { path: 'home', component: HomeComponent },
  { path: 'product', component: ProductComponent },

  // Posts
  { path: 'post', component: PostListComponent }, // público
  {
    path: 'post/manage',
    component: PostManageComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['psychologist'] }
  },

  { path: 'podcast', component: PodcastComponent },

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
    // Editar perfil propio (protegida)
  {
    path: 'profile/edit',
    component: ProfileEditComponent,
    canActivate: [AuthRoleGuard],
    data: { expectedRoles: ['patient', 'psychologist'] }
  },

  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
