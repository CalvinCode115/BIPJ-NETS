import { Component, Input } from '@angular/core';

export type TapatchiMood = 'happy' | 'normal' | 'sad' | 'starving' | 'sleeping' | 'excited';

@Component({
  selector: 'app-tapatchi',
  templateUrl: './tapatchi.component.html',
  styleUrls: ['./tapatchi.component.scss'],
  standalone: false,
})
export class TapatchiComponent {
  @Input() mood: TapatchiMood = 'happy';
  @Input() size: number = 200; // Default 200px
  @Input() animated: boolean = true; // Enable/disable idle animation
  
  // Computed sizes (proportional to main size)
  get cheekRadius(): number { return this.size * 0.075; }
  get eyeRadius(): number { return this.size * 0.03; }
  get bodyRadius(): number { return this.size * 0.4; }
}