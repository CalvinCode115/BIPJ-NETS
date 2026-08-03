import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PartnerChallengesPage } from './partner-challenges.page';

describe('PartnerChallengesPage', () => {
  let component: PartnerChallengesPage;
  let fixture: ComponentFixture<PartnerChallengesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PartnerChallengesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
