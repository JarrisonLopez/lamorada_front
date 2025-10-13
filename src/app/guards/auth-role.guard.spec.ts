import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { AuthRoleGuard } from './auth-role.guard';

describe('AuthRoleGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => AuthRoleGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
