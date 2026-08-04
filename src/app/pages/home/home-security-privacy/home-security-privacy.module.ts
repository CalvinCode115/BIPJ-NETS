import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SecurityPrivacyPageRoutingModule } from './home-security-privacy-routing.module';
import { SecurityPrivacyPage } from './home-security-privacy.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, SecurityPrivacyPageRoutingModule],
  declarations: [SecurityPrivacyPage],
})
export class SecurityPrivacyPageModule {}
