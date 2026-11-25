import { Component, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { LoadingService } from './core/loading/loading.service';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly loading = inject(LoadingService);
  private readonly router = inject(Router);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart || event instanceof NavigationEnd ||
        event instanceof NavigationCancel || event instanceof NavigationError)
    ).subscribe(event => {
      if (event instanceof NavigationStart) this.loading.show();
      else this.loading.hide();
    });
  }
}
