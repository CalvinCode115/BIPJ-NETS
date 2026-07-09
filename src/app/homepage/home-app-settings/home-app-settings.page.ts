import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface AppSettingToggle {
  id: string;
  label: string;
  detail: string;
  enabled: boolean;
}

const SETTINGS_KEY = 'nets_app_settings';

@Component({
  selector: 'app-home-app-settings',
  templateUrl: './home-app-settings.page.html',
  styleUrls: ['./home-app-settings.page.scss'],
  standalone: false,
})
export class HomeAppSettingsPage implements OnInit {
  spendingPeriod: 'Monthly' | 'Weekly' = 'Monthly';
  savedMessage = '';

  toggles: AppSettingToggle[] = [
    {
      id: 'balance_visible',
      label: 'Show balance on Home',
      detail: 'Start with card balance visible instead of hidden',
      enabled: false,
    },
    {
      id: 'confirm_payments',
      label: 'Confirm before paying',
      detail: 'Always show a confirmation step for QR payments',
      enabled: true,
    },
    {
      id: 'login_alerts',
      label: 'Login alerts on Home',
      detail: 'Show PayNow banner when you open the app',
      enabled: true,
    },
  ];

  constructor(
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  goBack(): void {
    this.router.navigate(['/tabs/home/home-more']);
  }

  onToggleChange(setting: AppSettingToggle, enabled: boolean): void {
    setting.enabled = enabled;
    this.persistSettings();
  }

  onSpendingPeriodChange(value: string | number | undefined): void {
    this.spendingPeriod = value === 'Weekly' ? 'Weekly' : 'Monthly';
    this.persistSettings();
  }

  private loadSettings(): void {
    const userId = this.auth.userId;
    if (!userId) {
      return;
    }

    try {
      const raw = sessionStorage.getItem(`${SETTINGS_KEY}_${userId}`);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw) as {
        spendingPeriod?: 'Monthly' | 'Weekly';
        toggles?: Record<string, boolean>;
      };

      if (saved.spendingPeriod === 'Weekly' || saved.spendingPeriod === 'Monthly') {
        this.spendingPeriod = saved.spendingPeriod;
      }

      this.toggles.forEach((toggle) => {
        if (typeof saved.toggles?.[toggle.id] === 'boolean') {
          toggle.enabled = saved.toggles[toggle.id];
        }
      });
    } catch {
      // ignore invalid storage
    }
  }

  private persistSettings(): void {
    const userId = this.auth.userId;
    if (!userId) {
      return;
    }

    const payload = {
      spendingPeriod: this.spendingPeriod,
      toggles: Object.fromEntries(this.toggles.map((toggle) => [toggle.id, toggle.enabled])),
    };

    sessionStorage.setItem(`${SETTINGS_KEY}_${userId}`, JSON.stringify(payload));
    this.savedMessage = 'Settings saved.';
    window.setTimeout(() => {
      this.savedMessage = '';
    }, 2000);
  }
}
