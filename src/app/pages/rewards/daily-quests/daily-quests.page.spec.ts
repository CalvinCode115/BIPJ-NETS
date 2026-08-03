import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DailyQuestsPage } from './daily-quests.page';

describe('DailyQuestsPage', () => {
  let component: DailyQuestsPage;
  let fixture: ComponentFixture<DailyQuestsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DailyQuestsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
