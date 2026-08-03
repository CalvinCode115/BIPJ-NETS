import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { QuestWithProgress } from 'src/app/services/quest.models';
import { DailyQuestsService } from 'src/app/services/daily-quests.service';
import { SessionService } from 'src/app/services/session.service';

@Component({
  selector: 'app-daily-quests',
  templateUrl: './daily-quests.page.html',
  styleUrls: ['./daily-quests.page.scss'],
  standalone: false,
})
export class DailyQuestsPage {

  loading = true;
  error: string | null = null;

  resetsIn = '';
  completedCount = 0;
  totalCount = 0;
  incompleteQuests: QuestWithProgress[] = [];
  completedQuests: QuestWithProgress[] = [];

  claimingId: string | null = null;

  constructor(
    private questsService: DailyQuestsService,
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

    this.questsService.getDailyQuests(this.session.userId).subscribe({
      next: (res) => {
        this.resetsIn = res.resetsIn;
        this.completedCount = res.completedCount;
        this.totalCount = res.totalCount;
        this.incompleteQuests = res.incompleteQuests;
        this.completedQuests = res.completedQuests;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load daily quests', err);
        this.error = 'Could not load your daily quests. Pull down to try again.';
        this.loading = false;
      },
    });
  }

  refresh(event?: CustomEvent): void {
    this.questsService.getDailyQuests(this.session.userId).subscribe({
      next: (res) => {
        this.resetsIn = res.resetsIn;
        this.completedCount = res.completedCount;
        this.totalCount = res.totalCount;
        this.incompleteQuests = res.incompleteQuests;
        this.completedQuests = res.completedQuests;
        (event?.target as any)?.complete?.();
      },
      error: (err) => {
        console.error('Failed to refresh daily quests', err);
        (event?.target as any)?.complete?.();
      },
    });
  }

  claim(templateId: string): void {
    if (this.claimingId) return;
    this.claimingId = templateId;

    this.questsService.claimQuest(this.session.userId, templateId).subscribe({
      next: () => {
        this.claimingId = null;
        this.load(); // refresh so the quest moves into the Completed section
      },
      error: (err) => {
        console.error('Failed to claim daily quest reward', err);
        this.claimingId = null;
        // TODO: surface a toast to the user
      },
    });
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/tabs/rewards']);
    }
  }
}