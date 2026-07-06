import { Component, OnInit } from '@angular/core';
import { TapatchiComponent, TapatchiMood } from '../components/tapatchi/tapatchi.component';

@Component({
  selector: 'app-payogotchi',
  templateUrl: 'payogotchi.page.html',
  styleUrls: ['payogotchi.page.scss'],
  standalone: false,

})
export class PayogotchiPage implements OnInit {
  currentMood: TapatchiMood = 'happy';
  
  moods: TapatchiMood[] = ['happy', 'normal', 'sad', 'starving', 'sleeping', 'excited'];

  constructor() {}

  ngOnInit() {}

  setMood(mood: TapatchiMood) {
    this.currentMood = mood;
  }
}
