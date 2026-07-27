import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { QuestWithProgress } from 'shared/quest.models';
import { WeeklyQuestsService } from 'shared/weekly-quests.service';
import { SessionService } from 'shared/session.service';

@Component({
  selector: 'app-weekly-quests',
  templateUrl: './weekly-quests.page.html',
  styleUrls: ['./weekly-quests.page.scss'],
  standalone: false,
})
export class WeeklyQuestsPage {

  loading = true;
  error: string | null = null;

  resetsIn = '';
  inProgressQuests: QuestWithProgress[] = [];
  claimedQuests: QuestWithProgress[] = [];

  claimingId: string | null = null;

  constructor(
    private questsService: WeeklyQuestsService,
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

    this.questsService.getWeeklyQuests(this.session.userId).subscribe({
      next: (res) => {
        this.resetsIn = res.resetsIn;
        this.inProgressQuests = res.inProgressQuests;
        this.claimedQuests = res.claimedQuests;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load weekly quests', err);
        this.error = 'Could not load your weekly quests. Pull down to try again.';
        this.loading = false;
      },
    });
  }

  refresh(event?: CustomEvent): void {
    this.questsService.getWeeklyQuests(this.session.userId).subscribe({
      next: (res) => {
        this.resetsIn = res.resetsIn;
        this.inProgressQuests = res.inProgressQuests;
        this.claimedQuests = res.claimedQuests;
        (event?.target as any)?.complete?.();
      },
      error: (err) => {
        console.error('Failed to refresh weekly quests', err);
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
        this.load(); // refresh so the quest moves into the Claimed section
      },
      error: (err) => {
        console.error('Failed to claim weekly quest reward', err);
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