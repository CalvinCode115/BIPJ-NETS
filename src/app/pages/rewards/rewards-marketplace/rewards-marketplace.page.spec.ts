import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RewardsMarketplacePage } from './rewards-marketplace.page';

describe('RewardsMarketplacePage', () => {
  let component: RewardsMarketplacePage;
  let fixture: ComponentFixture<RewardsMarketplacePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RewardsMarketplacePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
