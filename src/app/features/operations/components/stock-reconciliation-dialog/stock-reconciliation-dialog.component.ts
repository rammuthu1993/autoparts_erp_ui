import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import type { OperationsPageComponent } from '../../pages/operations-page/operations-page.component';

@Component({
  selector: 'app-stock-reconciliation-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './stock-reconciliation-dialog.component.html',
  styleUrl: '../../pages/operations-page/operations-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockReconciliationDialogComponent {
  @Input({ required: true }) vm!: OperationsPageComponent;
  @Input({ required: true }) stock!: any;
}
