import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';

// the intro plays out in these steps, in order
type IntroPhase = 'banner' | 'story-one' | 'story-two' | 'cta';

@Component({
  selector: 'app-payogotchi-intro',
  templateUrl: './payogotchi-intro.page.html',
  styleUrls: ['./payogotchi-intro.page.scss'],
  standalone: false,
})
export class PayogotchiIntroPage implements OnInit, OnDestroy {
  // which step of the intro we're at now
  phase: IntroPhase = 'banner';

  private readonly order: IntroPhase[] = ['banner', 'story-one', 'story-two', 'cta'];
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // the story moves forward on its own, tapping skips ahead
    this.timers.push(setTimeout(() => (this.phase = 'story-one'), 2200));
    this.timers.push(setTimeout(() => (this.phase = 'story-two'), 4600));
    this.timers.push(setTimeout(() => (this.phase = 'cta'), 7000));
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  get isCta(): boolean {
    return this.phase === 'cta';
  }

  // true once the intro has reached (or gone past) this step
  reached(phase: IntroPhase): boolean {
    return this.order.indexOf(this.phase) >= this.order.indexOf(phase);
  }

  // tap anywhere to skip to the end (useful during demos)
  skip(): void {
    this.clearTimers();
    this.phase = 'cta';
  }

  // start button - go to egg selection
  start(): void {
    this.router.navigate(['/tabs/payogotchi/egg-selection']);
  }

  private clearTimers(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }
}
