import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyVouchersPage } from './my-vouchers.page';

describe('MyVouchersPage', () => {
  let component: MyVouchersPage;
  let fixture: ComponentFixture<MyVouchersPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MyVouchersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
