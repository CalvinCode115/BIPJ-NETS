import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { PetService } from '../../../services/pet.service';
import { PetBridgeService } from '../../../services/pet-bridge.service';
import { PointsService } from '../../../services/points.service';
import { PetStage, PetState, TransactionResult } from '../../../models/pet.model';
import {
  VARIANT_DISPLAY_NAMES,
  resolveVariant,
} from '../../../components/tapatchi/tapatchi.component';

@Component({
  selector: 'app-payogotchi-home',
  templateUrl: './payogotchi-home.page.html',
  styleUrls: ['./payogotchi-home.page.scss'],
  standalone: false,
})
export class PayogotchiHomePage {
  // direct reference to the shared pet state, so any change shows up straight away
  readonly pet: PetState;

  // ---- Popups that show after a transaction ----
  // result of the latest transaction, decides which popups appear
  result: TransactionResult | null = null;
  showFeedback = false;
  showLevelUp = false;
  showEvolution = false;

  // shop name for the feedback popup
  feedbackMerchant = '';
  // numbers shown in the level up popup
  levelFrom = 0;
  levelTo = 0;
  levelReward = 0;
  // info shown in the evolution popup
  evoFrom: PetStage = 'Baby';
  evoTo: PetStage = 'Teen';
  evoUnlocks: string[] = [];

  // Real NETS Points balance (Rewards tab's own currency) — Payogotchi no
  // longer tracks a separate points number of its own, it just displays
  // this and, on a level-up/evolution, asks the backend to add to it.
  totalPoints = 0;

  constructor(
    private router: Router,
    private petService: PetService,
    private bridge: PetBridgeService,
    private pointsService: PointsService,
    private toastCtrl: ToastController,
  ) {
    this.pet = this.petService.state;
  }

  // When the user returns to Home, play any celebration queued by a real
  // NETS payment made on the Pay tab, or a non-purchase bonus like the
  // tutorial completion XP (the pet already updated + persisted; this just
  // shows the feedback / level-up / evolution popups now).
  ionViewWillEnter(): void {
    const pending = this.bridge.consumePending();
    if (pending) {
      this.celebrate(pending.result, pending.merchant);
    }
    this.loadPointsBalance();
  }

  // Reads the real balance from the Rewards side (PointsService), the same
  // one the NETS Points page shows. Best-effort: on failure Total Activity
  // just keeps whatever it last showed.
  private loadPointsBalance(): void {
    this.pointsService.getBalance(this.petService.ownerId).subscribe({
      next: (res) => (this.totalPoints = res.totalPoints),
      error: () => {},
    });
  }

  // ---- Display values (the service works these out) ----
  get mood() {
    return this.petService.mood;
  }

  get statusText(): string {
    return this.petService.statusText;
  }

  get xpPercent(): number {
    return this.petService.xpProgress * 100;
  }

  /** The character's species name, e.g. 'Gozarutchi' — shown under the pet's own name. */
  get speciesName(): string {
    return VARIANT_DISPLAY_NAMES[resolveVariant(this.pet.selectedEgg)];
  }

  get daysTogether(): number {
    return this.petService.daysTogether;
  }

  get favouriteMerchant(): string | null {
    return this.petService.favouriteMerchant;
  }

  // Plays the feedback -> level up -> evolution chain for a transaction
  // result from a real NETS payment (queued by PetBridgeService while the
  // user was on the Pay tab), or a non-purchase bonus (e.g. tutorial
  // completion) when `merchant` is omitted.
  private celebrate(r: TransactionResult, merchant?: string): void {
    this.result = r;
    this.feedbackMerchant = merchant ?? '';

    // fill in the popup data using the actual result
    if (r.leveledUp && r.newLevel != null) {
      this.levelFrom = r.newLevel - 1;
      this.levelTo = r.newLevel;
      this.levelReward = r.pointsEarned;
    }
    if (r.evolved && r.newStage) {
      this.evoFrom = this.prevStage(r.newStage);
      this.evoTo = r.newStage;
      this.evoUnlocks = this.unlocksFor(r.newStage);
    }

    // if the daily cap got hit, just show a toast at the top
    if (r.xpCapped) {
      this.presentToast('🌙 Daily XP cap reached — reset the cap or come back tomorrow!', 'warning');
    }

    // if this transaction revived a fainted pet, go straight to the
    // Welcome Back screen instead of the normal popups
    if (r.revived) {
      this.go('welcome-back');
      return;
    }

    if (merchant) {
      // real purchase: show the "you paid X" feedback step first, which
      // chains into level up / evolution via onFeedbackDismiss()
      if (r.xpGained > 0) {
        this.showFeedback = true;
      }
    } else if (r.leveledUp) {
      // non-purchase bonus: no feedback step to show, jump straight in
      this.showLevelUp = true;
    } else if (r.evolved) {
      this.showEvolution = true;
    }
  }

  onFeedbackDismiss(): void {
    this.showFeedback = false;
    if (this.result?.leveledUp) {
      this.showLevelUp = true;
    }
  }

  onLevelUpDismiss(): void {
    this.showLevelUp = false;
    if (this.result?.evolved) {
      this.showEvolution = true;
    } else {
      // refresh Total Activity now the backend has had time to credit the
      // level-up bonus (fired as soon as the milestone was detected)
      this.loadPointsBalance();
    }
  }

  onEvolutionDismiss(): void {
    this.showEvolution = false;
    this.loadPointsBalance();
  }

  feed(): void {
    this.petService.feed();
  }

  private async presentToast(message: string, color: 'warning' | 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2400,
      position: 'top',
      color,
    });
    await toast.present();
  }

  private prevStage(stage: PetStage): PetStage {
    return stage === 'Adult' ? 'Teen' : 'Baby';
  }

  private unlocksFor(stage: PetStage): string[] {
    if (stage === 'Adult') {
      return ['Extra cosmetic slots', 'Max XP cap (600 / day)', 'Prestige features'];
    }
    return ['Cosmetic slot opened', 'Bigger XP cap (400 / day)', 'New mini-games'];
  }

  // ---- Navigation ----
  private go(screen: string): void {
    this.router.navigate([`/tabs/payogotchi/${screen}`]);
  }

  openMiniGame(): void {
    this.go('mini-game');
  }
  openDressUp(): void {
    this.go('cosmetics-dressup');
  }
  openSettings(): void {
    this.go('pet-settings');
  }
}
