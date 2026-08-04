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

// the shapes you can tap: emoji, circle colour theme, and points given.
// points are kept small (1-3) since happiness only goes up to 100
const SHAPE_TYPES: { emoji: string; theme: ShapeTheme; points: number }[] = [
  { emoji: '💕', theme: 'heart', points: 2 },
  { emoji: '⭐', theme: 'star', points: 3 },
  { emoji: '🫧', theme: 'bubble', points: 1 },
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
  // how much happiness the pet actually got (can be less than the
  // score if the meter was already close to 100)
  happinessGained = 0;

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

  // countdown formatted as mm:ss for the timer chip
  get timerDisplay(): string {
    const m = Math.floor(this.timeLeft / 60);
    const s = this.timeLeft % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ---- Game control ----
  startGame(): void {
    this.score = 0;
    this.happinessGained = 0;
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

  // leave the mini game and go back to Home.
  // if the player quits halfway, still give the happiness earned so far
  exit(): void {
    this.stopTimers();
    if (this.phase === 'playing' && this.score > 0) {
      this.awardHappiness();
    }
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
    // remove it automatically once it floats off the top (means it was missed)
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
    this.awardHappiness();
  }

  // give the score to the pet as happiness (service caps it at 100),
  // and remember how much it really went up so we can show it
  private awardHappiness(): void {
    const before = this.petService.state.happiness;
    this.petService.play(this.score);
    this.happinessGained = this.petService.state.happiness - before;
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
