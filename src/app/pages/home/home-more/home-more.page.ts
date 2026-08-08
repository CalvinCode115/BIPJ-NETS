import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { PetService } from '../../../services/pet.service';
import { PointsService } from '../../../services/points.service';

interface MoreMenuItem {
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  route?: string;
  action?: 'help' | 'terms' | 'security';
}

@Component({
  selector: 'app-more',
  templateUrl: './home-more.page.html',
  styleUrls: ['./home-more.page.scss'],
  standalone: false,
})
export class MorePage implements OnInit {
  profile = {
    initials: 'AT',
    name: 'Alex Tan',
    phone: '+65 9123 4567',
  };

  pointsBalance = 0;

  isHelpOpen = false;
  isTermsOpen = false;

  menuItems: MoreMenuItem[] = [
    {
      title: 'Card Management',
      subtitle: 'Unlink cards & receive settings',
      icon: 'card',
      iconColor: '#2f80ed',
      iconBg: '#e8f1fd',
      route: '/tabs/home/home-card-management',
    },
    {
      title: 'Transaction History',
      subtitle: 'View all transactions',
      icon: 'receipt',
      iconColor: '#27ae60',
      iconBg: '#e8f8ef',
      route: '/tabs/home/home-all-transactions',
    },
    {
      title: 'Spending Reports',
      subtitle: 'Analytics & insights',
      icon: 'bar-chart',
      iconColor: '#f2c94c',
      iconBg: '#fff8e1',
      route: '/tabs/home/home-full-report',
    },
    {
      title: 'NETS Rewards',
      subtitle: '3,820 points available',
      icon: 'gift',
      iconColor: '#9b51e0',
      iconBg: '#f3e8ff',
      route: '/tabs/rewards',
    },
    {
      title: 'Notifications',
      subtitle: 'Alerts & preferences',
      icon: 'notifications',
      iconColor: '#8e8e93',
      iconBg: '#f5f5f7',
      route: '/tabs/home/home-notifications',
    },
    {
      title: 'Security & Privacy',
      subtitle: 'Change PIN',
      icon: 'lock-closed',
      iconColor: '#eb5757',
      iconBg: '#fdecea',
      action: 'security',
    },
    {
      title: 'App Settings',
      subtitle: 'Preferences',
      icon: 'settings',
      iconColor: '#8e8e93',
      iconBg: '#f5f5f7',
      route: '/tabs/home/home-app-settings',
    },
    {
      title: 'Help Center',
      subtitle: 'FAQs & support',
      icon: 'help-circle',
      iconColor: '#2f80ed',
      iconBg: '#e8f1fd',
      action: 'help',
    },
    {
      title: 'Terms & Conditions',
      subtitle: 'Legal info',
      icon: 'document-text',
      iconColor: '#8e8e93',
      iconBg: '#f5f5f7',
      action: 'terms',
    },
  ];

  constructor(
    private router: Router,
    private auth: AuthService,
    private pointsService: PointsService,
    private petService: PetService
  ) {}

  get petOnboarded(): boolean {
    return this.petService.state.onboarded;
  }

  get petXp(): number {
    return this.petService.state.xp ?? 0;
  }

  ngOnInit(): void {
    this.refreshProfile();
  }

  ionViewWillEnter(): void {
    this.refreshProfile();
  }

  closeMore(): void {
    this.router.navigate(['/tabs/home']);
  }

  onMenuItemClick(item: MoreMenuItem): void {
    if (item.route) {
      this.router.navigate([item.route]);
      return;
    }

    if (item.action === 'help') {
      this.isHelpOpen = true;
      return;
    }

    if (item.action === 'terms') {
      this.isTermsOpen = true;
      return;
    }

    if (item.action === 'security') {
      this.router.navigate(['/tabs/home/home-security-privacy']);
    }
  }

  closeHelp(): void {
    this.isHelpOpen = false;
  }

  closeTerms(): void {
    this.isTermsOpen = false;
  }

  logOut(): void {
    this.auth.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  private refreshProfile(): void {
    const user = this.auth.currentUser;
    if (!user) {
      return;
    }

    this.profile = {
      initials: this.auth.getInitials(user.name),
      name: user.name,
      phone: user.phone,
    };
    this.pointsBalance = user.points ?? 0;

    const rewardsItem = this.menuItems.find((item) => item.title === 'NETS Rewards');
    if (rewardsItem) {
      rewardsItem.subtitle = `${this.pointsBalance.toLocaleString()} points available`;
    }

    this.pointsService.getBalance(user.id).subscribe({
      next: (res) => {
        this.pointsBalance = res.totalPoints;
        if (rewardsItem) {
          rewardsItem.subtitle = `${res.totalPoints.toLocaleString()} points available`;
        }
      },
      error: (err) => console.error('Failed to load points balance', err),
    });
  }
}
