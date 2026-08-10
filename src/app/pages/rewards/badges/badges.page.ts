import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Badge } from 'src/app/services/badges.models';
import { SessionService } from 'src/app/services/session.service';
import { BadgesService } from 'src/app/services/badges.service';


@Component({
  selector: 'app-badges',
  templateUrl: './badges.page.html',
  styleUrls: ['./badges.page.scss'],
  standalone: false,
})
export class BadgesPage {

  loading = true;
  error: string | null = null;

  badges: Badge[] = [];
  earnedCount = 0;
  totalCount = 0;

  constructor(
    private badgesService: BadgesService,
    private session: SessionService,
    private router: Router,
    private location: Location
  ) {}

  ionViewWillEnter(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.error = null;

    this.badgesService.getBadges(this.session.userId).subscribe({
      next: (res) => {
        this.badges = res.badges;
        this.earnedCount = res.earnedCount;
        this.totalCount = res.totalCount;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load badges', err);
        this.error = 'Could not load your badges. Pull down to try again.';
        this.loading = false;
      },
    });
  }

  refresh(event?: CustomEvent): void {
    this.badgesService.getBadges(this.session.userId).subscribe({
      next: (res) => {
        this.badges = res.badges;
        this.earnedCount = res.earnedCount;
        this.totalCount = res.totalCount;
        (event?.target as any)?.complete?.();
      },
      error: (err) => {
        console.error('Failed to refresh badges', err);
        (event?.target as any)?.complete?.();
      },
    });
  }

  sourceLabel(sourceType: string): string {
    switch (sourceType) {
      case 'daily': return 'Daily Quest';
      case 'weekly': return 'Weekly Quest';
      case 'challenge': return 'Partner Challenge';
      default: return '';
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
