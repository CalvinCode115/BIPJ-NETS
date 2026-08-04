import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PointHistoryPage } from './point-history.page';

describe('PointHistoryPage', () => {
  let component: PointHistoryPage;
  let fixture: ComponentFixture<PointHistoryPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PointHistoryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
