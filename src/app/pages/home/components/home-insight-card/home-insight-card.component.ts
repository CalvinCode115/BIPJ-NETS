import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-home-insight-card',
  templateUrl: './home-insight-card.component.html',
  styleUrls: ['./home-insight-card.component.scss'],
  standalone: false,
})
export class HomeInsightCardComponent {
  @Input() title = '';
  @Input() message = '';
  @Input() style: { icon: string; color: string; bg: string } = {
    icon: 'sparkles',
    color: '#6c63ff',
    bg: '#ede7f6',
  };
  @Input() traits: string[] = [];
  @Input() error = '';

  @Output() viewAll = new EventEmitter<void>();

  onViewAll(): void {
    this.viewAll.emit();
  }
}
