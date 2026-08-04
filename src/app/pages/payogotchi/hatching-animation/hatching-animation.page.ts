import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';

/** The stages of the hatch: wobble → crack → burst → reveal the pet. */
type HatchPhase = 'shaking' | 'cracking' | 'bursting' | 'revealed';

interface Particle {
  left: number; // %
  top: number; // %
  size: number; // px
  color: string;
  delay: number; // s
  rounded: boolean;
}

@Component({
  selector: 'app-hatching-animation',
  templateUrl: './hatching-animation.page.html',
  styleUrls: ['./hatching-animation.page.scss'],
  standalone: false,
})
export class HatchingAnimationPage implements OnInit, OnDestroy {
  /** Current stage of the hatch animation. */
  phase: HatchPhase = 'shaking';

  /** Egg visuals carried from the Hatching Progress screen (with a fallback). */
  eggGradient = 'linear-gradient(160deg, #4a4a4a, #1a1a1a)';
  eggEmoji = '💎';
  eggRare = true;

  /** Confetti particles scattered behind the reveal (matches the Figma palette). */
  readonly particles: Particle[] = this.buildParticles();

  private readonly nextRoute = '/tabs/payogotchi/naming-screen';
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private router: Router) {
    const egg = this.router.getCurrentNavigation()?.extras?.state?.['egg'];
    if (egg) {
      this.eggGradient = egg.gradient ?? this.eggGradient;
      this.eggEmoji = egg.emoji ?? '';
      this.eggRare = !!egg.rare;
    }
  }

  ngOnInit(): void {
    // Timed sequence: shake, then crack, then burst, then reveal the pet.
    this.timers.push(setTimeout(() => (this.phase = 'cracking'), 2400));
    this.timers.push(setTimeout(() => (this.phase = 'bursting'), 3800));
    this.timers.push(setTimeout(() => (this.phase = 'revealed'), 4300));
  }

  ngOnDestroy(): void {
    this.timers.forEach((t) => clearTimeout(t));
  }

  get isRevealed(): boolean {
    return this.phase === 'revealed';
  }

  /** Tap anywhere during the animation to jump straight to the reveal (demo-friendly). */
  skip(): void {
    if (this.isRevealed) {
      return;
    }
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.phase = 'revealed';
  }

  /** "Meet Your Tapatchi →" — continue to the naming screen. */
  meetTapatchi(): void {
    this.router.navigate([this.nextRoute], {
      state: { egg: { gradient: this.eggGradient, emoji: this.eggEmoji, rare: this.eggRare } },
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  private buildParticles(): Particle[] {
    const colors = ['#d4bbff', '#ffb6c1', '#b2f2bb', '#ffe066', '#87ceeb'];
    const particles: Particle[] = [];
    for (let i = 0; i < 14; i++) {
      particles.push({
        left: 8 + Math.random() * 84,
        top: 20 + Math.random() * 55,
        size: 5 + Math.random() * 6,
        color: colors[i % colors.length],
        delay: Math.random() * 0.5,
        rounded: Math.random() > 0.5,
      });
    }
    return particles;
  }
}
