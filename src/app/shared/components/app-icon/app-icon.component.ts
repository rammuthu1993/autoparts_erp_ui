import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './app-icon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppIconComponent {
  readonly name = input.required<string>();
  readonly size = input<number>(20);
}
