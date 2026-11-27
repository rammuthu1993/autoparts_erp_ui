import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import type { OperationsPageComponent } from '../../pages/operations-page/operations-page.component';

/**
 * Modal view child for OperationsPageComponent. The parent owns data loading, permissions, API calls,
 * and modal visibility; this component owns the modal's HTML template.
 */
@Component({
  selector: 'app-purchase-draft-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './purchase-draft-dialog.component.html',
  styleUrl: '../../pages/operations-page/operations-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseDraftDialogComponent {
  @Input({ required: true }) vm!: OperationsPageComponent;
}
