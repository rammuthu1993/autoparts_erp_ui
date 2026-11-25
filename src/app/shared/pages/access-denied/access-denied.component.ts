import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="denied">
      <div class="code">403</div>
      <h1>Access restricted</h1>
      <p>Your account does not have permission to open this page.</p>
      <a routerLink="/dashboard">Return to dashboard</a>
    </section>
  `,
  styles: [`
    .denied{min-height:55vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#172033}
    .code{font-size:64px;font-weight:800;color:#cbd5e1;letter-spacing:-.06em}
    h1{margin:0;font-size:24px}p{color:#64748b;font-size:13px}
    a{margin-top:10px;color:#2457c5;font-size:13px;font-weight:700;text-decoration:none}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccessDeniedComponent {}
