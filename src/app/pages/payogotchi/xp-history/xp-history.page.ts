import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PetService } from '../../../services/pet.service';
import {
  TransactionsService,
  TransactionRecord,
} from '../../../services/transactions.service';

/** The API filters per month, so this bounds how far back we fan out. */
const MONTHS_TO_SCAN = 12;

/** One XP-earning transaction in the day's list. */
interface XpEntry {
  merchant: string;
  time: string;
  xp: number;
  capped: boolean;
  category: string;
  icon: string;
}

/** All XP entries for one calendar day. */
interface XpDay {
  label: string;
  /** Sortable yyyymmdd key, so days order correctly across months. */
  key: number;
  totalXp: number;
  entries: XpEntry[];
}

/** A month's rows, tagged with the period they were fetched under. */
interface TaggedRows {
  year: number;
  month: number;
  rows: TransactionRecord[];
}

/** Day-by-day record of XP earned from NETS payments. */
@Component({
  selector: 'app-xp-history',
  templateUrl: './xp-history.page.html',
  styleUrls: ['./xp-history.page.scss'],
  standalone: false,
})
export class XpHistoryPage implements OnInit {
  /** Days with XP, newest first. */
  days: XpDay[] = [];
  dayIndex = 0;

  loading = true;
  loadFailed = false;

  constructor(
    private location: Location,
    private petService: PetService,
    private transactions: TransactionsService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  // ---- Display values ----

  get currentDay(): XpDay | null {
    return this.days[this.dayIndex] ?? null;
  }

  get hasOlder(): boolean {
    return this.dayIndex < this.days.length - 1;
  }

  get hasNewer(): boolean {
    return this.dayIndex > 0;
  }

  get dayPosition(): string {
    if (this.days.length === 0) {
      return '';
    }
    return `${this.dayIndex + 1} of ${this.days.length}`;
  }

  /** Total this page can itemise, across every month scanned. */
  get itemisedXp(): number {
    return this.days.reduce((sum, day) => sum + day.totalXp, 0);
  }

  get lifetimeXp(): number {
    return this.petService.state.totalXpEarned;
  }

  /** XP with no transaction behind it: tutorial, quests, or pre-tracking payments. */
  get unattributedXp(): number {
    return Math.max(0, this.lifetimeXp - this.itemisedXp);
  }

  get hasUnattributed(): boolean {
    return this.unattributedXp > 0;
  }

  // ---- Navigation ----

  previousDay(): void {
    if (this.hasOlder) {
      this.dayIndex += 1;
    }
  }

  nextDay(): void {
    if (this.hasNewer) {
      this.dayIndex -= 1;
    }
  }

  back(): void {
    this.location.back();
  }

  // ---- Loading ----

  private load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.days = [];
    this.dayIndex = 0;

    const userId = this.petService.ownerId;

    // one request per month; a failed month yields an empty batch
    const requests = this.monthsToScan().map(({ year, month }) =>
      this.transactions.getTransactions(userId, { month, year }).pipe(
        map((res): TaggedRows => ({ year, month, rows: res?.transactions ?? [] })),
        catchError(() => of({ year, month, rows: [] as TransactionRecord[] })),
      ),
    );

    forkJoin(requests).subscribe({
      next: (batches) => {
        this.days = this.groupByDay(batches);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  /** The last MONTHS_TO_SCAN periods, most recent first. */
  private monthsToScan(): Array<{ year: number; month: number }> {
    const periods: Array<{ year: number; month: number }> = [];
    const cursor = new Date();
    cursor.setDate(1); // avoids month-end rollover when stepping back

    for (let i = 0; i < MONTHS_TO_SCAN; i++) {
      periods.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
      cursor.setMonth(cursor.getMonth() - 1);
    }
    return periods;
  }

  /**
   * Buckets XP-earning transactions by day. The API's date ('16 Aug') has no
   * year, so each batch's own period supplies one to build the sort key.
   */
  private groupByDay(batches: TaggedRows[]): XpDay[] {
    const byKey = new Map<number, XpDay>();

    batches.forEach(({ year, month, rows }) => {
      rows.forEach((row) => {
        const xp = row.xpGained ?? 0;
        if (xp <= 0) {
          return;
        }

        const dayNumber = parseInt(row.date, 10);
        if (Number.isNaN(dayNumber)) {
          return;
        }

        const key = year * 10000 + month * 100 + dayNumber;
        let day = byKey.get(key);
        if (!day) {
          day = { label: `${row.date} ${year}`, key, totalXp: 0, entries: [] };
          byKey.set(key, day);
        }

        day.totalXp += xp;
        day.entries.push({
          merchant: row.merchant,
          time: row.time,
          xp,
          capped: row.xpCapped === true,
          category: row.category,
          icon: row.icon,
        });
      });
    });

    return Array.from(byKey.values()).sort((a, b) => b.key - a.key);
  }
}
