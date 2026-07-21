import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { PetService } from '../../../services/pet.service';
import { PetState } from '../../../models/pet.model';

/** A single stat row inside the "Journey" card. */
interface JourneyStat {
  icon: string;
  label: string;
  value: string;
}

/** A tappable settings row. `screen` navigates; `action` runs a local handler. */
interface SettingRow {
  icon: string;
  title: string;
  subtitle?: string;
  /** Renders the subtitle in the accent (red) colour, e.g. trial warnings. */
  danger?: boolean;
  /** Payogotchi route segment to navigate to when tapped. */
  screen?: string;
  /** Non-navigation handler key for demo-only rows. */
  action?: 'notifications' | 'break' | 'share';
}

interface SettingSection {
  heading: string;
  rows: SettingRow[];
}

@Component({
  selector: 'app-pet-settings',
  templateUrl: './pet-settings.page.html',
  styleUrls: ['./pet-settings.page.scss'],
  standalone: false,
})
export class PetSettingsPage {
  /** Live reference to the shared pet state (name/level/stats reflect instantly). */
  readonly pet: PetState;

  /** Lifetime stats — static demo values until a stats service exists. */
  readonly journeyStats: JourneyStat[] = [
    { icon: '📅', label: 'Days Together', value: '12 days' },
    { icon: '🛒', label: 'Total Transactions', value: '47' },
    { icon: '⭐', label: 'Total XP Earned', value: '12,450' },
    { icon: '❤️', label: 'Favourite Merchant', value: 'Starbucks' },
    { icon: '🔥', label: 'Longest Streak', value: '7 days' },
  ];

  constructor(
    private router: Router,
    private location: Location,
    private petService: PetService
  ) {
    this.pet = this.petService.state;
  }

  /** Menu sections. A getter so name-dependent labels stay in sync with the pet. */
  get sections(): SettingSection[] {
    const name = this.pet.name;
    return [
      {
        heading: 'Pet Management',
        rows: [
          { icon: '📝', title: `Rename ${name}`, screen: 'rename-pet' },
          {
            icon: '🥚',
            title: 'Choose New Egg',
            subtitle: '⚠️ Trial: 4 swaps left',
            danger: true,
            screen: 'egg-reselection-trial',
          },
        ],
      },
      {
        heading: 'Settings',
        rows: [
          {
            icon: '🔔',
            title: 'Pet Notifications',
            subtitle: 'Hunger reminders, level ups',
            action: 'notifications',
          },
          {
            icon: '👤',
            title: 'Account Settings',
            subtitle: 'Profile, security, preferences',
            screen: 'account-settings',
          },
          {
            icon: '❓',
            title: 'How Payogotchi Works',
            subtitle: 'Learn how to play',
            screen: 'how-payogotchi-works',
          },
          {
            icon: '🚪',
            title: 'Take a Break',
            subtitle: 'Pause notifications temporarily',
            action: 'break',
          },
        ],
      },
      {
        heading: 'Social',
        rows: [{ icon: '📤', title: 'Share My Tapatchi', action: 'share' }],
      },
    ];
  }

  // ---- Interaction ----
  onRow(row: SettingRow): void {
    if (row.screen) {
      this.go(row.screen);
      return;
    }
    // Demo-only rows: no dedicated screen yet.
    // TODO: wire notifications toggle, break mode, and native share.
  }

  back(): void {
    this.location.back();
  }

  private go(screen: string): void {
    this.router.navigate([`/tabs/payogotchi/${screen}`]);
  }
}
