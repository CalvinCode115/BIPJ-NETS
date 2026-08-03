import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SendPointsPage } from './send-points.page';

describe('SendPointsPage', () => {
  let component: SendPointsPage;
  let fixture: ComponentFixture<SendPointsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SendPointsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
