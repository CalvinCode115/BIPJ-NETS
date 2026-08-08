import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface HomeSecondaryAction {
  label: string;
  icon: string;
  color: string;
  route?: string;
}

@Component({
  selector: 'app-home-secondary-actions',
  templateUrl: './home-secondary-actions.component.html',
  styleUrls: ['./home-secondary-actions.component.scss'],
  standalone: false,
})
export class HomeSecondaryActionsComponent {
  @Input() actions: HomeSecondaryAction[] = [];

  @Output() actionSelected = new EventEmitter<HomeSecondaryAction>();

  onAction(action: HomeSecondaryAction): void {
    this.actionSelected.emit(action);
  }
}
