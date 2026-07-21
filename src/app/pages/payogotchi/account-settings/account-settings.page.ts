import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

/** A tappable settings row. `screen` navigates; `action` runs a local handler. */
interface SettingRow {
  icon: string;
  title: string;
  subtitle: string;
  /** Payogotchi route segment to navigate to when tapped. */
  screen?: string;
}

interface SettingSection {
  heading: string;
  rows: SettingRow[];
}

@Component({
  selector: 'app-account-settings',
  templateUrl: './account-settings.page.html',
  styleUrls: ['./account-settings.page.scss'],
  standalone: false,
})
export class AccountSettingsPage {
  /** Static demo profile until a real user/account service is wired. */
  readonly profile = {
    name: 'John Tan',
    email: 'john.tan@email.com',
    tier: '🎖️ Gold Member',
    since: 'Member since March 2024',
  };

  readonly appVersion = 'NETS App v3.2.1';

  readonly sections: SettingSection[] = [
    {
      heading: 'Account & Security',
      rows: [
        { icon: '👤', title: 'Personal Information', subtitle: 'Name, email, phone, address' },
        { icon: '🔒', title: 'Security & Privacy', subtitle: 'Password, 2FA, biometrics' },
        { icon: '💳', title: 'Linked Accounts & Cards', subtitle: 'Bank accounts, cards, payment methods' },
        { icon: '🔔', title: 'Notification Preferences', subtitle: 'Manage app notifications' },
        { icon: '🌍', title: 'Language & Region', subtitle: 'English (Singapore)' },
      ],
    },
    {
      heading: 'Payogotchi Specific',
      rows: [
        {
          icon: '🎮',
          title: 'Payogotchi Settings',
          subtitle: 'Pet preferences, gameplay options',
          screen: 'pet-settings',
        },
        { icon: '👥', title: 'Friends & Leaderboard', subtitle: 'Manage friends, privacy settings' },
        { icon: '📊', title: 'Activity & Stats', subtitle: 'Spending insights, pet milestones' },
      ],
    },
    {
      heading: 'Support & About',
      rows: [
        { icon: '❓', title: 'Help Center', subtitle: 'FAQs and support articles' },
        { icon: '📞', title: 'Contact Support', subtitle: 'Get help from NETS team' },
        { icon: '📋', title: 'Terms & Privacy Policy', subtitle: 'Legal information' },
      ],
    },
  ];

  constructor(private router: Router, private location: Location) {}

  onRow(row: SettingRow): void {
    if (row.screen) {
      this.router.navigate([`/tabs/payogotchi/${row.screen}`]);
    }
    // Demo-only rows: no dedicated screen yet.
  }

  editProfile(): void {
    // TODO: open profile editor once that screen exists.
  }

  logOut(): void {
    // TODO: wire real sign-out through the auth service.
  }

  back(): void {
    this.location.back();
  }
}
