import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface PeriodSheetOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-period-select-sheet',
  templateUrl: './period-select-sheet.component.html',
  styleUrls: ['./period-select-sheet.component.scss'],
  standalone: false,
})
export class PeriodSelectSheetComponent {
  @Input() isOpen = false;
  @Input() title = 'Select Period';
  @Input() options: PeriodSheetOption[] = [];
  @Input() selectedId = '';

  @Output() selected = new EventEmitter<string>();
  @Output() dismissed = new EventEmitter<void>();

  onSelect(optionId: string): void {
    this.selected.emit(optionId);
  }

  onDismiss(): void {
    this.dismissed.emit();
  }
}
