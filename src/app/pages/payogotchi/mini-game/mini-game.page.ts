import { Component, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { PetService } from '../../../services/pet.service';

type GamePhase = 'idle' | 'playing' | 'ended';

type ShapeTheme = 'heart' | 'star' | 'bubble';

interface Shape {
  id: number;
  emoji: string;
  theme: ShapeTheme;
  points: number;
  left: number; // %
  duration: number; // ms (rise time)
  popped: boolean;
}

/** Tappable shapes: emoji, themed circle colour, and point value. */
const SHAPE_TYPES: { emoji: string; theme: ShapeTheme; points: number }[] = [
  { emoji: '💕', theme: 'heart', points: 5 },
  { emoji: '⭐', theme: 'star', points: 10 },
  { emoji: '🫧', theme: 'bubble', points: 3 },
];

@Component({
  selector: 'app-mini-game',
  templateUrl: './mini-game.page.html',
  styleUrls: ['./mini-game.page.scss'],
  standalone: false,
})
export class MiniGamePage implements OnDestroy {
  readonly gameLength = 30; // seconds
  readonly maxPlays = 3;

  phase: GamePhase = 'idle';
  score = 0;
  timeLeft = this.gameLength;
  playsToday = 1;
  shapes: Shape[] = [];

  private nextId = 0;
  private countdownId?: ReturnType<typeof setInterval>;
  private spawnId?: ReturnType<typeof setInterval>;
  private removalTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(private location: Location, private petService: PetService) {}

  ngOnDestroy(): void {
    this.stopTimers();
  }

  get petName(): string {
    return this.petService.state.name;
  }

  /** mm:ss countdown for the timer chip. */
  get timerDisplay(): string {
    const m = Math.floor(this.timeLeft / 60);
    const s = this.timeLeft % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ---- Game control ----
  startGame(): void {
    this.score = 0;
    this.timeLeft = this.gameLength;
    this.shapes = [];
    this.phase = 'playing';
    this.playsToday = Math.min(this.playsToday + 1, this.maxPlays);

    this.countdownId = setInterval(() => this.tick(), 1000);
    this.spawnId = setInterval(() => this.spawnShape(), 800);
  }

  playAgain(): void {
    this.startGame();
  }

  /** Leave the mini-game and return to Home. */
  exit(): void {
    this.stopTimers();
    this.location.back();
  }

  // ---- Tapping ----
  tapShape(shape: Shape): void {
    if (shape.popped) {
      return;
    }
    shape.popped = true;
    this.score += shape.points;
    this.scheduleRemoval(shape.id, 250);
  }

  trackByShapeId(_index: number, shape: Shape): number {
    return shape.id;
  }

  // ---- Internals ----
  private tick(): void {
    this.timeLeft -= 1;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endGame();
    }
  }

  private spawnShape(): void {
    const type = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
    const shape: Shape = {
      id: this.nextId++,
      emoji: type.emoji,
      theme: type.theme,
      points: type.points,
      left: 6 + Math.random() * 74,
      duration: 3400 + Math.random() * 1400,
      popped: false,
    };
    this.shapes.push(shape);
    // Auto-remove once it has floated off the top (missed).
    this.scheduleRemoval(shape.id, shape.duration);
  }

  private scheduleRemoval(id: number, delay: number): void {
    const timer = setTimeout(() => {
      this.shapes = this.shapes.filter((s) => s.id !== id);
    }, delay);
    this.removalTimers.push(timer);
  }

  private endGame(): void {
    this.stopTimers();
    this.shapes = [];
    this.phase = 'ended';
    // Award the earned happiness back to the pet (clamped at 100 by the service).
    this.petService.play(this.score);
  }

  private stopTimers(): void {
    if (this.countdownId) {
      clearInterval(this.countdownId);
      this.countdownId = undefined;
    }
    if (this.spawnId) {
      clearInterval(this.spawnId);
      this.spawnId = undefined;
    }
    this.removalTimers.forEach((t) => clearTimeout(t));
    this.removalTimers = [];
  }
}
