import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import type { SalesPageComponent } from '../../pages/sales-page/sales-page.component';

/**
 * Modal view child for SalesPageComponent. The parent owns data loading, permissions, API calls,
 * and modal visibility; this component owns the modal's HTML template.
 */
@Component({
  selector: 'app-sales-details-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sales-details-dialog.component.html',
  styleUrl: '../../pages/sales-page/sales-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesDetailsDialogComponent {
  @Input({ required: true }) vm!: SalesPageComponent;
  @Input({ required: true }) sale!: any;
}
