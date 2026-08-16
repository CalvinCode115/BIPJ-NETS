import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { PetService } from '../../../services/pet.service';
import { PetBridgeService } from '../../../services/pet-bridge.service';
import { PointsService } from '../../../services/points.service';
import {
  PetStage,
  PetState,
  TransactionResult,
  MilestoneConfirmation,
} from '../../../models/pet.model';
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
export class PayogotchiHomePage implements OnDestroy {
  /** Live reference to the shared pet state. */
  readonly pet: PetState;

  // ---- Celebration popups ----
  result: TransactionResult | null = null;
  showFeedback = false;
  showLevelUp = false;
  showEvolution = false;

  feedbackMerchant = '';
  levelFrom = 0;
  levelTo = 0;
  levelReward = 0;

  evoFrom: PetStage = 'Baby';
  evoTo: PetStage = 'Teen';
  evoUnlocks: string[] = [];

  /** Real NETS Points balance, owned by the Rewards tab. */
  totalPoints = 0;

  private confirmSub?: Subscription;

  constructor(
    private router: Router,
    private petService: PetService,
    private bridge: PetBridgeService,
    private pointsService: PointsService,
    private toastCtrl: ToastController,
  ) {
    this.pet = this.petService.state;
    this.confirmSub = this.petService.milestoneBonusConfirmed.subscribe(
      (confirmation) => this.applyMilestoneConfirmation(confirmation),
    );
  }

  ngOnDestroy(): void {
    this.confirmSub?.unsubscribe();
  }

  /** Replaces the optimistic bonus figure with the amount actually credited. */
  private applyMilestoneConfirmation(confirmation: MilestoneConfirmation): void {
    this.levelReward = confirmation.pointsAwarded;
    if (this.result) {
      this.result.pointsEarned = confirmation.pointsAwarded;
    }

    if (confirmation.capped) {
      let message: string;
      if (confirmation.pointsAwarded > 0) {
        message = `Daily points limit — ${confirmation.pointsAwarded} of ${confirmation.requested} NETS Points added`;
      } else {
        message = 'Daily points limit reached — no NETS Points added for this milestone';
      }
      this.presentToast(message, 'warning');
    }

    this.loadPointsBalance();
  }

  /** Plays any celebration queued while the user was on another tab. */
  async ionViewWillEnter(): Promise<void> {
    const pending = this.bridge.consumePending();
    if (pending) {
      this.celebrate(pending.result, pending.merchant);
    }
    this.loadPointsBalance();
    await this.applyClaimedQuestRewards(pending !== null);
  }

  /** Applies quest and challenge XP queued on the backend. */
  private async applyClaimedQuestRewards(celebrationBusy: boolean): Promise<void> {
    const claimed = await this.petService.drainPendingRewards();
    if (claimed.length === 0) {
      return;
    }

    const merged = this.mergeResults(claimed);

    // don't stack a second modal chain on top of one already showing
    if (celebrationBusy) {
      this.presentToast(`🎁 +${merged.xpGained} XP from your claimed quests!`, 'success');
      return;
    }

    this.celebrate(merged);

    // celebrate() only opens a popup for a level-up or evolution
    if (!merged.leveledUp && !merged.evolved) {
      this.presentToast(`🎁 +${merged.xpGained} XP from your claimed quests!`, 'success');
    }
  }

  /** Folds several queued grants into one result, for display only. */
  private mergeResults(results: TransactionResult[]): TransactionResult {
    const lastLevelUp = [...results].reverse().find((r) => r.leveledUp);
    const lastEvolve = [...results].reverse().find((r) => r.evolved);

    return {
      xpGained: results.reduce((sum, r) => sum + r.xpGained, 0),
      xpCapped: false,
      hungerRestored: 0,
      happinessGained: results.reduce((sum, r) => sum + r.happinessGained, 0),
      pointsEarned: results.reduce((sum, r) => sum + r.pointsEarned, 0),
      leveledUp: lastLevelUp !== undefined,
      newLevel: lastLevelUp?.newLevel,
      evolved: lastEvolve !== undefined,
      newStage: lastEvolve?.newStage,
      revived: false,
    };
  }

  /** Loads the real NETS Points balance. Failure leaves the last value shown. */
  private loadPointsBalance(): void {
    this.pointsService.getBalance(this.petService.ownerId).subscribe({
      next: (res) => (this.totalPoints = res.totalPoints),
      error: () => {},
    });
  }

  // ---- Display values ----
  get mood() {
    return this.petService.mood;
  }

  get statusText(): string {
    return this.petService.statusText;
  }

  get xpPercent(): number {
    return this.petService.xpProgress * 100;
  }

  /** Species name, e.g. 'Gozarutchi'. */
  get speciesName(): string {
    return VARIANT_DISPLAY_NAMES[resolveVariant(this.pet.selectedEgg)];
  }

  get daysTogether(): number {
    return this.petService.daysTogether;
  }

  get favouriteMerchant(): string | null {
    return this.petService.favouriteMerchant;
  }

  /** Runs the feedback → level up → evolution popup chain. */
  private celebrate(r: TransactionResult, merchant?: string): void {
    this.result = r;
    this.feedbackMerchant = merchant ?? '';

    if (r.leveledUp && r.newLevel != null) {
      this.levelFrom = r.newLevel - 1;
      this.levelTo = r.newLevel;
      this.levelReward = r.pointsEarned;
    }

    // applied after the optimistic figure so it overwrites, not the reverse
    const confirmation = this.petService.consumeMilestoneConfirmation();
    if (confirmation) {
      this.applyMilestoneConfirmation(confirmation);
    }

    if (r.evolved && r.newStage) {
      this.evoFrom = this.prevStage(r.newStage);
      this.evoTo = r.newStage;
      this.evoUnlocks = this.unlocksFor(r.newStage);
    }

    if (r.xpCapped) {
      this.presentToast('🌙 Daily XP cap reached — reset the cap or come back tomorrow!', 'warning');
    }

    // a revived pet gets the Welcome Back screen instead of the popup chain
    if (r.revived) {
      this.go('welcome-back');
      return;
    }

    if (merchant) {
      // purchases start at the feedback step, which chains on from there.
      // Nested on purpose: a zero-XP purchase shows nothing, and must not
      // fall through to the level-up branch below.
      if (r.xpGained > 0) {
        this.showFeedback = true;
      }
    } else if (r.leveledUp) {
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

  /** Perks listed on the evolution popup. Mirrored in stage-evolution.page.ts. */
  private unlocksFor(stage: PetStage): string[] {
    if (stage === 'Adult') {
      return ['Max XP cap (600 / day)', 'Prestige features'];
    }
    return ['Bigger XP cap (400 / day)', 'New mini-games'];
  }

  // ---- Navigation ----
  private go(screen: string): void {
    this.router.navigate([`/tabs/payogotchi/${screen}`]);
  }

  openMiniGame(): void {
    this.go('mini-game');
  }

  openSettings(): void {
    this.go('pet-settings');
  }
}
