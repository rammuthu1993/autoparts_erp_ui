import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FinanceOperationsComponent } from '../../pages/finance-operations/finance-operations.component';

@Component({
  selector: 'app-purchase-return-detail-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-return-detail-dialog.component.html',
  styleUrl: '../../pages/finance-operations/finance-operations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PurchaseReturnDetailDialogComponent {
  @Input({ required: true }) vm!: FinanceOperationsComponent;
  @Input({ required: true }) r!: any;
}
