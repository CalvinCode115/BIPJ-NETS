import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { PointsHistoryEntry } from 'shared/points.models';
import { PointsService } from 'shared/points.service';
import { SessionService } from 'shared/session.service';


const PREVIEW_LIMIT = 8;

@Component({
  selector: 'app-nets-points',
  templateUrl: './nets-points.page.html',
  styleUrls: ['./nets-points.page.scss'],
  standalone: false,
})
export class NetsPointsPage implements OnInit {

  loading = true;
  error: string | null = null;

  totalPoints = 0;
  earnedThisWeek = 0;
  spentThisWeek = 0;
  pointsHistory: PointsHistoryEntry[] = [];

  constructor(
    private pointsService: PointsService,
    private session: SessionService,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.load();
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

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/rewards']);
    }
  }

  sendPointsToFriends(): void {
    this.router.navigate(['/send-points']);
  }

  goToPointHistory(): void {
    this.router.navigate(['/point-history']);
  }
}
