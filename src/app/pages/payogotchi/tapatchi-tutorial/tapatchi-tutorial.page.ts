import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { PetService } from '../../../services/pet.service';
import { PetBridgeService } from '../../../services/pet-bridge.service';

/** One onboarding slide. `pet: true` renders the live TapatchiComponent; otherwise `emoji` is shown. */
interface TutorialSlide {
  heading: string;
  body: string;
  /** Emoji shown inside the emblem circle (ignored when `pet` is true). */
  emoji?: string;
  /** Slide 1 shows the actual Tapatchi character instead of an emoji. */
  pet?: boolean;
}

/** XP awarded once the user finishes the tutorial via "Get Started". */
const COMPLETION_XP = 100;

@Component({
  selector: 'app-tapatchi-tutorial',
  templateUrl: './tapatchi-tutorial.page.html',
  styleUrls: ['./tapatchi-tutorial.page.scss'],
  standalone: false,
})
export class TapatchiTutorialPage implements OnInit {
  readonly slides: TutorialSlide[] = [
    {
      pet: true,
      heading: 'Meet Your Tapatchi!',
      body:
        'Your Tapatchi is a digital companion that grows with every NETS transaction. ' +
        'Take care of it like a real pet - feed it, play with it, and watch it evolve into amazing forms!',
    },
    {
      emoji: '📊',
      heading: 'Understanding the 3 Meters',
      body:
        'Your Tapatchi has three important stats: Experience (XP) for leveling up, Hunger that needs food, ' +
        'and Happiness that requires play time. Keep all three balanced!',
    },
    {
      emoji: '🍪',
      heading: 'How to Feed Your Pet',
      body:
        'Every food transaction you make with NETS automatically feeds your Tapatchi! Coffee, lunch, snacks - ' +
        'they all count. The more you spend, the fuller your pet gets.',
    },
    {
      emoji: '⭐',
      heading: 'Level Up & Evolution',
      body:
        'As you earn XP, your Tapatchi will level up and evolve into new forms! Each stage has unique ' +
        'appearances and abilities. Can you reach the final form?',
    },
    {
      emoji: '🎮',
      heading: 'Quests & Rewards',
      body:
        'Complete daily quests to earn bonus XP and NETS Points! Levelling up and evolving your Tapatchi ' +
        'earns Points too — spend them on real vouchers over in the Rewards tab.',
    },
  ];

  index = 0;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private toastCtrl: ToastController,
    private pet: PetService,
    private bridge: PetBridgeService,
  ) {}

  ngOnInit(): void {
    // Allow deep-linking to a specific topic (?slide=N) from "How Payogotchi Works".
    const raw = Number(this.route.snapshot.queryParamMap.get('slide'));
    if (Number.isInteger(raw)) {
      this.index = Math.max(0, Math.min(raw, this.slides.length - 1));
    }
  }

  get slide(): TutorialSlide {
    return this.slides[this.index];
  }

  get isFirst(): boolean {
    return this.index === 0;
  }

  get isLast(): boolean {
    return this.index === this.slides.length - 1;
  }

  previous(): void {
    if (!this.isFirst) {
      this.index -= 1;
    }
  }

  /** Advance a slide, or finish the tutorial on the final slide. */
  next(): void {
    if (this.isLast) {
      this.finish();
    } else {
      this.index += 1;
    }
  }

  /** Leave the tutorial without a reward. */
  skip(): void {
    this.location.back();
  }

  /** Awards the one-time completion XP, queues the celebration, returns to Home. */
  private async finish(): Promise<void> {
    const result = this.pet.awardTutorialCompletion(COMPLETION_XP);

    const toast = await this.toastCtrl.create({
      message: result
        ? `🎉 Tutorial completed! +${COMPLETION_XP} XP for ${this.pet.state.name}`
        : `Thanks for reviewing, ${this.pet.state.name}!`,
      duration: 2200,
      position: 'top',
      cssClass: 'tutorial-toast',
    });
    await toast.present();

    if (result) {
      // no merchant: Home skips the feedback step and goes straight to Level Up
      this.bridge.queueResult(result);
    }
    this.router.navigate(['/tabs/payogotchi/payogotchi-home']);
  }
}
