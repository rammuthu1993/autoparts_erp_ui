import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should create the login component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with an empty form', () => {
    expect(component.loginForm.controls.username.value).toBe('');
    expect(component.loginForm.controls.password.value).toBe('');
    expect(component.loginForm.invalid).toBe(true);
  });

  it('should validate required username', () => {
    component.loginForm.controls.username.markAsTouched();

    expect(
      component.loginForm.controls.username.hasError('required')
    ).toBe(true);
  });

  it('should validate required password', () => {
    component.loginForm.controls.password.markAsTouched();

    expect(
      component.loginForm.controls.password.hasError('required')
    ).toBe(true);
  });

  it('should toggle password visibility', () => {
    expect(component.showPassword()).toBe(false);

    component.togglePasswordVisibility();

    expect(component.showPassword()).toBe(true);

    component.togglePasswordVisibility();

    expect(component.showPassword()).toBe(false);
  });

  it('should accept valid login form data', () => {
    component.loginForm.setValue({
      username: 'admin',
      password: 'example-password',
      rememberMe: false
    });

    expect(component.loginForm.valid).toBe(true);
  });

  it('should not submit an invalid form', () => {
    component.submit();

    expect(component.loginForm.touched).toBe(true);
    expect(component.isSubmitting()).toBe(false);
  });
});
