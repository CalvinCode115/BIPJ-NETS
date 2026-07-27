import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { ToastController } from '@ionic/angular';
import { ChallengeWithProgress } from 'shared/quest.models';
import { PartnerChallengesService } from 'shared/partner-challenges.service';
import { SessionService } from 'shared/session.service';


@Component({
  selector: 'app-partner-challenges',
  templateUrl: './partner-challenges.page.html',
  styleUrls: ['./partner-challenges.page.scss'],
  standalone: false,
})
export class PartnerChallengesPage {

  loading = true;
  error: string | null = null;

  clearedCount = 0;
  totalCount = 0;
  activeChallenges: ChallengeWithProgress[] = [];
  pastChallenges: ChallengeWithProgress[] = [];

  busyChallengeId: string | null = null;

  constructor(
    private challengesService: PartnerChallengesService,
    private session: SessionService,
    private router: Router,
    private location: Location,
    private toastController: ToastController
  ) {}

  ionViewWillEnter(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.error = null;

    this.challengesService.getChallenges(this.session.userId).subscribe({
      next: (res) => {
        this.clearedCount = res.clearedCount;
        this.totalCount = res.totalCount;
        this.activeChallenges = res.activeChallenges;
        this.pastChallenges = res.pastChallenges;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load partner challenges', err);
        this.error = 'Could not load challenges. Pull down to try again.';
        this.loading = false;
      },
    });
  }

  refresh(event?: CustomEvent): void {
    this.challengesService.getChallenges(this.session.userId).subscribe({
      next: (res) => {
        this.clearedCount = res.clearedCount;
        this.totalCount = res.totalCount;
        this.activeChallenges = res.activeChallenges;
        this.pastChallenges = res.pastChallenges;
        (event?.target as any)?.complete?.();
      },
      error: (err) => {
        console.error('Failed to refresh partner challenges', err);
        (event?.target as any)?.complete?.();
      },
    });
  }

  start(challengeId: string): void {
    if (this.busyChallengeId) return;
    this.busyChallengeId = challengeId;

    this.challengesService.startChallenge(this.session.userId, challengeId).subscribe({
      next: async () => {
        this.busyChallengeId = null;
        this.load();

        const toast = await this.toastController.create({
          message: 'Challenge started, all the best!',
          duration: 2000,
          position: 'top',
          color: 'success',
        });
        await toast.present();
      },
      error: (err) => {
        console.error('Failed to start challenge', err);
        this.busyChallengeId = null;
      },
    });
  }

  claim(challengeId: string): void {
    if (this.busyChallengeId) return;
    this.busyChallengeId = challengeId;

    this.challengesService.claimChallenge(this.session.userId, challengeId).subscribe({
      next: () => {
        this.busyChallengeId = null;
        this.load();
      },
      error: (err) => {
        console.error('Failed to claim challenge reward', err);
        this.busyChallengeId = null;
      },
    });
  }

  footerLabel(challenge: ChallengeWithProgress): string {
    switch (challenge.durationType) {
      case 'fixed':
        return `${challenge.durationDays ?? '—'} days`;
      case 'monthly':
        return 'Monthly Challenge';
      case 'permanent':
        return 'Permanent Quest';
      case 'event':
        return challenge.eventName ?? 'Limited-Time Event';
      default:
        return '';
    }
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/tabs/rewards']);
    }
  }
}