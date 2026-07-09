import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NetsPointsPage } from './nets-points.page';

describe('NetsPointsPage', () => {
  let component: NetsPointsPage;
  let fixture: ComponentFixture<NetsPointsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(NetsPointsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
