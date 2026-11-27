import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import type { MasterPageComponent } from '../../pages/master-page/master-page.component';

/**
 * Modal view child for MasterPageComponent. The parent owns data loading, permissions, API calls,
 * and modal visibility; this component owns the modal's HTML template.
 */
@Component({
  selector: 'app-product-barcode-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './product-barcode-dialog.component.html',
  styleUrl: '../../pages/master-page/master-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductBarcodeDialogComponent {
  @Input({ required: true }) vm!: MasterPageComponent;
  @Input({ required: true }) barcode!: any;
}
