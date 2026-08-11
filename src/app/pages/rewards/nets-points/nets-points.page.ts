import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { ToastController } from '@ionic/angular';
import { PointsHistoryEntry } from 'src/app/services/points.models';
import { CheckinStatus } from 'src/app/services/daily-checkin.models';
import { PointsService } from 'src/app/services/points.service';
import { DailyCheckinService } from 'src/app/services/daily-checkin.service';
import { SessionService } from 'src/app/services/session.service';
import { DailyQuestsService } from 'src/app/services/daily-quests.service';
import { WeeklyQuestsService } from 'src/app/services/weekly-quests.service';
import { PartnerChallengesService } from 'src/app/services/partner-challenges.service';
import { MyVouchersService } from 'src/app/services/my-vouchers.service';
import { PointsBudgetService } from 'src/app/services/points-budget.service';

const PREVIEW_LIMIT = 8;

@Component({
  selector: 'app-nets-points',
  templateUrl: './nets-points.page.html',
  styleUrls: ['./nets-points.page.scss'],
  standalone: false,
})
export class NetsPointsPage {

  loading = true;
  error: string | null = null;

  totalPoints = 0;
  earnedThisWeek = 0;
  spentThisWeek = 0;
  pointsHistory: PointsHistoryEntry[] = [];

  checkinStatus: CheckinStatus | null = null;
  checkingIn = false;

  // Quick-nav notification badges — how many unclaimed/urgent items sit
  // behind each tile, so the grid tells you something at a glance instead
  // of being pure navigation.
  dailyQuestsBadge = 0;
  weeklyQuestsBadge = 0;
  challengesBadge = 0;
  vouchersBadge = 0;

  constructor(
    private pointsService: PointsService,
    private dailyCheckinService: DailyCheckinService,
    private session: SessionService,
    private router: Router,
    private location: Location,
    private toastController: ToastController,
    private dailyQuestsService: DailyQuestsService,
    private weeklyQuestsService: WeeklyQuestsService,
    private partnerChallengesService: PartnerChallengesService,
    private myVouchersService: MyVouchersService,
    private pointsBudgetService: PointsBudgetService
  ) {}

  ionViewWillEnter(): void {
    this.load();
    this.loadCheckinStatus();
    this.loadNavBadges();
    this.checkDailyCapStatus();
  }

  /**
   * Shows a toast if today's earning caps have been hit — fires every time
   * the page is visited while capped, so the user always understands why
   * their next transaction/quest claim might not add any points.
   */
  private checkDailyCapStatus(): void {
    this.pointsBudgetService.getBudgetStatus(this.session.userId).subscribe({
      next: async (res) => {
        if (res.pointsCapped) {
          const toast = await this.toastController.create({
            message: "You've reached today's 300-point earning limit \u2014 more points resume tomorrow!",
            duration: 3000,
            position: 'top',
            color: 'warning',
          });
          await toast.present();
        } else if (res.transactionCapReached) {
          const toast = await this.toastController.create({
            message: "You've reached today's transaction limit for earning points.",
            duration: 3000,
            position: 'top',
            color: 'warning',
          });
          await toast.present();
        }
      },
      error: (err) => console.error('Failed to load points budget status', err),
    });
  }

  private loadCheckinStatus(): void {
    this.dailyCheckinService.getStatus(this.session.userId).subscribe({
      next: (res) => (this.checkinStatus = res),
      error: (err) => console.error('Failed to load check-in status', err),
    });
  }

  /**
   * Computes the little notification-dot counts on each quick-nav tile.
   * Deliberately reuses the exact same endpoints each destination page
   * already calls — no new backend routes, just filtering the response
   * client-side for "completed but not yet claimed" / "expiring soon".
   */
  private loadNavBadges(): void {
    const userId = this.session.userId;

    this.dailyQuestsService.getDailyQuests(userId).subscribe({
      next: (res) => {
        this.dailyQuestsBadge = res.incompleteQuests.filter(
          (q) => q.progress?.completed && !q.progress?.claimed
        ).length;
      },
      error: (err) => console.error('Failed to load daily quests badge', err),
    });

    this.weeklyQuestsService.getWeeklyQuests(userId).subscribe({
      next: (res) => {
        this.weeklyQuestsBadge = res.inProgressQuests.filter(
          (q) => q.progress?.completed && !q.progress?.claimed
        ).length;
      },
      error: (err) => console.error('Failed to load weekly quests badge', err),
    });

    this.partnerChallengesService.getChallenges(userId).subscribe({
      next: (res) => {
        this.challengesBadge = res.activeChallenges.filter(
          (c) => c.progress?.completed && !c.progress?.claimed
        ).length;
      },
      error: (err) => console.error('Failed to load challenges badge', err),
    });

    this.myVouchersService.getVouchers(userId).subscribe({
      next: (res) => {
        const now = Date.now();
        this.vouchersBadge = res.available.filter((v) => {
          const daysLeft = Math.ceil((new Date(v.expiresAt).getTime() - now) / (24 * 60 * 60 * 1000));
          return daysLeft <= 7;
        }).length;
      },
      error: (err) => console.error('Failed to load vouchers badge', err),
    });
  }

  /** 'completed' | 'today' | 'locked' — drives the 7-day row's dot styling. */
  dayStatus(day: number): 'completed' | 'today' | 'locked' {
    if (!this.checkinStatus) return 'locked';
    const { currentDay, canCheckInToday } = this.checkinStatus;

    if (canCheckInToday) {
      if (day < currentDay) return 'completed';
      if (day === currentDay) return 'today';
      return 'locked';
    }

    // Already checked in today — today's day counts as completed too.
    return day <= currentDay ? 'completed' : 'locked';
  }

  checkIn(): void {
    if (this.checkingIn || !this.checkinStatus?.canCheckInToday) return;
    this.checkingIn = true;

    this.dailyCheckinService.checkIn(this.session.userId).subscribe({
      next: async (res) => {
        this.checkingIn = false;
        this.loadCheckinStatus();
        this.load(); // refresh balance + history to reflect the new points

        const toast = await this.toastController.create({
          message: `Day ${res.day} check-in complete — +${res.reward} points!`,
          duration: 2000,
          position: 'top',
          color: 'success',
        });
        await toast.present();
      },
      error: async (err) => {
        this.checkingIn = false;
        console.error('Failed to check in', err);
        const toast = await this.toastController.create({
          message: err?.error?.error || 'Could not check in. Please try again.',
          duration: 2000,
          position: 'top',
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    const userId = this.session.userId;

    this.pointsService.getBalance(userId).subscribe({
      next: (res) => {
        this.totalPoints = res.totalPoints;
        this.earnedThisWeek = res.earnedThisWeek;
        this.spentThisWeek = res.spentThisWeek;
      },
      error: (err) => {
        console.error('Failed to load points balance', err);
        this.error = 'Could not load your points balance.';
      },
    });

    this.pointsService.getHistory(userId, { limit: PREVIEW_LIMIT }).subscribe({
      next: (res) => {
        this.pointsHistory = res.entries;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load points history preview', err);
        this.loading = false;
      },
    });
  }

  sendPointsToFriends(): void {
    this.router.navigate(['/tabs/rewards/send-points']);
  }

  goToPointHistory(): void {
    this.router.navigate(['/tabs/rewards/point-history']);
  }

  // ---- The 5 quick-nav buttons, now living here instead of the old /rewards hub page ----

  goToDailyQuests(): void {
    this.router.navigate(['/tabs/rewards/daily-quests']);
  }

  goToWeeklyQuests(): void {
    this.router.navigate(['/tabs/rewards/weekly-quests']);
  }

  goToPartnerChallenges(): void {
    this.router.navigate(['/tabs/rewards/partner-challenges']);
  }

  goToMarketplace(): void {
    this.router.navigate(['/tabs/rewards/rewards-marketplace']);
  }

  goToMyVouchers(): void {
    this.router.navigate(['/tabs/rewards/my-vouchers']);
  }

  goToBadges(): void {
    this.router.navigate(['/tabs/rewards/badges']);
  }

  goToAboutPoints(): void {
    this.router.navigate(['/tabs/rewards/about-points']);
  }
}