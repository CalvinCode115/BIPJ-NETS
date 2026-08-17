import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './core/api.config';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private http: HttpClient) {
    this.warmApi();
  }

  // Wake the API as early as we possibly can
  private warmApi(): void {
    this.http
      .get(`${API_BASE_URL}/health`)
      .subscribe({ next: () => {}, error: () => {} });
  }
}
