import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import type { FinanceOperationsComponent } from '../../pages/finance-operations/finance-operations.component';

/**
 * Modal view child for FinanceOperationsComponent. The parent owns data loading, permissions, API calls,
 * and modal visibility; this component owns the modal's HTML template.
 */
@Component({
  selector: 'app-sales-return-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sales-return-dialog.component.html',
  styleUrl: '../../pages/finance-operations/finance-operations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesReturnDialogComponent {
  @Input({ required: true }) vm!: FinanceOperationsComponent;
  @Input({ required: true }) sale!: any;
}
