import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ToastController } from '@ionic/angular';
import { PetService } from '../../../services/pet.service';

/** Maximum length of a pet name (matches the Figma "X/12 characters" counter). */
const NAME_MAX = 12;

@Component({
  selector: 'app-rename-pet',
  templateUrl: './rename-pet.page.html',
  styleUrls: ['./rename-pet.page.scss'],
  standalone: false,
})
export class RenamePetPage implements OnInit {
  readonly maxLength = NAME_MAX;

  /** The name the pet had when the screen opened (shown as "Currently: …"). */
  currentName = '';

  /** Two-way bound to the text input. */
  newName = '';

  constructor(
    private pet: PetService,
    private location: Location,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    this.currentName = this.pet.state.name;
    this.newName = this.pet.state.name;
  }

  get level(): number {
    return this.pet.state.level;
  }

  get stage(): string {
    return this.pet.state.stage;
  }

  /** Live character count for the counter under the input. */
  get charCount(): number {
    return this.newName.length;
  }

  /** Save is only allowed when there is a non-empty, changed name. */
  get canSave(): boolean {
    const trimmed = this.newName.trim();
    return trimmed.length > 0 && trimmed !== this.currentName;
  }

  clearName(): void {
    this.newName = '';
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      return;
    }
    this.pet.setName(this.newName);
    const toast = await this.toastCtrl.create({
      message: `✅ Renamed to ${this.pet.state.name}!`,
      duration: 2000,
      position: 'top',
      cssClass: 'tutorial-toast',
    });
    await toast.present();
    this.location.back();
  }

  cancel(): void {
    this.location.back();
  }
}
