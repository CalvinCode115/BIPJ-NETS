import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'app-about-points',
  templateUrl: './about-points.page.html',
  styleUrls: ['./about-points.page.scss'],
  standalone: false,
})
export class AboutPointsPage {

  constructor(
    private router: Router,
    private location: Location
  ) {}

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/tabs/rewards']);
    }
  }
}
