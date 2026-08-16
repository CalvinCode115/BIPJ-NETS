import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

/** A tappable tutorial topic row shown on the "How Payogotchi Works" hub. */
interface TutorialTopic {
  /** Emoji shown in the leading badge. */
  icon: string;
  title: string;
  subtitle: string;
  /** Slide index passed to the tapatchi-tutorial screen when opened. */
  slide: number;
}

@Component({
  selector: 'app-how-payogotchi-works',
  templateUrl: './how-payogotchi-works.page.html',
  styleUrls: ['./how-payogotchi-works.page.scss'],
  standalone: false,
})
export class HowPayogotchiWorksPage {
  readonly topics: TutorialTopic[] = [
    { icon: '🐣', title: 'Meet Your Tapatchi', subtitle: 'Learn about your digital companion', slide: 0 },
    { icon: '📊', title: 'Understanding the Meters', subtitle: 'XP, Hunger, and Happiness explained', slide: 1 },
    { icon: '🍔', title: 'Feeding Your Pet', subtitle: 'How food transactions work', slide: 2 },
    { icon: '⭐', title: 'Levels & Evolution', subtitle: 'Watch your pet grow', slide: 3 },
    { icon: '🎮', title: 'Quests & Rewards', subtitle: 'Earn bonus XP and NETS Points', slide: 4 },
  ];

  constructor(private router: Router, private location: Location) {}

  /** Open the slide tutorial at the tapped topic. */
  openTopic(topic: TutorialTopic): void {
    this.router.navigate(['/tabs/payogotchi/tapatchi-tutorial'], {
      queryParams: { slide: topic.slide },
    });
  }

  contactSupport(): void {
    // TODO: wire to real NETS support flow once available.
  }

  back(): void {
    this.location.back();
  }
}
