import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { PetService } from '../../../services/pet.service';
import { PetBridgeService } from '../../../services/pet-bridge.service';
import { PetStage, PetState, TransactionResult, TxnCategory } from '../../../models/pet.model';

interface DemoTxn {
  label: string;
  // shop name that shows up in the feedback popup
  merchant: string;
  amount: number;
  category: TxnCategory;
  // which colour style the button uses
  theme: 'coffee' | 'lunch' | 'shop';
}

interface Quest {
  label: string;
  done: boolean;
  // reward text like "+30 Happy"
  reward: string;
  rewardTheme: 'done' | 'happy';
}

@Component({
  selector: 'app-payogotchi-home',
  templateUrl: './payogotchi-home.page.html',
  styleUrls: ['./payogotchi-home.page.scss'],
  standalone: false,
})
export class PayogotchiHomePage {
  // direct reference to the shared pet state, so any change shows up straight away
  readonly pet: PetState;

  readonly demoTxns: DemoTxn[] = [
    { label: '☕ Coffee $5', merchant: 'Coffee Bean', amount: 5, category: 'other', theme: 'coffee' },
    { label: '🍜 Lunch $12', merchant: 'Hawker Lunch', amount: 12, category: 'food', theme: 'lunch' },
    { label: '🛍️ Shop $25', merchant: 'Uniqlo', amount: 25, category: 'shopping', theme: 'shop' },
  ];

  readonly quests: Quest[] = [
    { label: 'Make first transaction', done: true, reward: '✓ Done', rewardTheme: 'done' },
    { label: 'Eat at hawker stall', done: false, reward: '+30 Happy', rewardTheme: 'happy' },
  ];

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

  constructor(
    private router: Router,
    private petService: PetService,
    private bridge: PetBridgeService,
    private toastCtrl: ToastController,
  ) {
    this.pet = this.petService.state;
  }

  // When the user returns to Home, play any celebration queued by a real
  // NETS payment made on the Pay tab (the pet already updated + persisted;
  // this just shows the feedback / level-up / evolution popups now).
  ionViewWillEnter(): void {
    const pending = this.bridge.consumePending();
    if (pending) {
      this.celebrate(pending.result, pending.merchant);
    }
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

  // ---- Care actions ----
  runTransaction(txn: DemoTxn): void {
    const r = this.petService.applyTransaction(txn.amount, txn.category, txn.merchant);
    this.celebrate(r, txn.merchant);
  }

  // Plays the feedback -> level up -> evolution chain for a transaction
  // result, whether it came from a Home demo button or a real NETS payment
  // (queued by PetBridgeService while the user was on the Pay tab).
  private celebrate(r: TransactionResult, merchant: string): void {
    this.result = r;
    this.feedbackMerchant = merchant;

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

    // only show the celebration popups if some XP was actually earned.
    // closing the feedback popup then leads into level up / evolution
    if (r.xpGained > 0) {
      this.showFeedback = true;
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
    }
  }

  onEvolutionDismiss(): void {
    this.showEvolution = false;
  }

  feed(): void {
    this.petService.feed();
  }

  // demo button: clear today's XP cap so we can level up again during the demo
  resetXpCap(): void {
    this.petService.resetDailyXpCap();
    this.presentToast('♻️ XP cap reset — earn away!', 'success');
  }

  // demo button: wipe the pet and go through the intro/egg flow again
  restartOnboarding(): void {
    this.petService.resetNewUser();
    this.router.navigateByUrl('/tabs/payogotchi');
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
  // demo button: force the level up popup to show
  openLevelUp(): void {
    this.result = null; // opened manually, so don't lead into evolution after
    this.levelFrom = this.pet.level;
    this.levelTo = this.pet.level + 1;
    this.levelReward = 50;
    this.showLevelUp = true;
  }

  // demo button: force the evolution popup to show
  openEvolve(): void {
    this.result = null;
    const to: PetStage = this.pet.stage === 'Baby' ? 'Teen' : 'Adult';
    this.evoFrom = this.pet.stage === 'Adult' ? 'Teen' : this.pet.stage;
    this.evoTo = to;
    this.evoUnlocks = this.unlocksFor(to);
    this.showEvolution = true;
  }
  openFaint(): void {
    this.go('fainted-pet');
  }
  openReturn(): void {
    this.go('welcome-back');
  }
  openQuests(): void {
    // quests are on Yunen's Rewards tab, will link up later
  }
}
