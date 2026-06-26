import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SignupPageRoutingModule } from './signup-routing.module';
import { SignupPage } from './signup.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, SignupPageRoutingModule],
  declarations: [SignupPage],
})
export class SignupPageModule {}
