import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeeklyQuestsPage } from './weekly-quests.page';

describe('WeeklyQuestsPage', () => {
  let component: WeeklyQuestsPage;
  let fixture: ComponentFixture<WeeklyQuestsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(WeeklyQuestsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
