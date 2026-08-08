import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface HomeQuickAction {
  label: string;
  icon: string;
  color: string;
  route?: string;
  action?: 'top-up';
}

@Component({
  selector: 'app-home-quick-actions',
  templateUrl: './home-quick-actions.component.html',
  styleUrls: ['./home-quick-actions.component.scss'],
  standalone: false,
})
export class HomeQuickActionsComponent {
  @Input() actions: HomeQuickAction[] = [];
  @Input() canTopUp = false;
  @Input() canPayQr = false;
  @Input() topUpDisabledReason = '';
  @Input() payDisabledReason = '';

  @Output() actionSelected = new EventEmitter<HomeQuickAction>();

  isDisabled(action: HomeQuickAction): boolean {
    if (action.action === 'top-up') {
      return !this.canTopUp;
    }

    if (action.label === 'Pay' || action.label === 'QR Code') {
      return !this.canPayQr;
    }

    return false;
  }

  titleFor(action: HomeQuickAction): string | null {
    if (action.action === 'top-up' && !this.canTopUp) {
      return this.topUpDisabledReason || null;
    }

    if ((action.label === 'Pay' || action.label === 'QR Code') && !this.canPayQr) {
      return this.payDisabledReason || null;
    }

    return null;
  }

  onAction(action: HomeQuickAction): void {
    this.actionSelected.emit(action);
  }
}
