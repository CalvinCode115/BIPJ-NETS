import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-nets-logo',
  templateUrl: './nets-logo.component.html',
  styleUrls: ['./nets-logo.component.scss'],
  standalone: false,
})
export class NetsLogoComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
}
