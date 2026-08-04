import { Component, Input } from '@angular/core';
import { PetService } from '../../services/pet.service';

export type TapatchiMood = 'happy' | 'normal' | 'sad' | 'starving' | 'sleeping' | 'excited' | 'fainted';

// The eight characters. 'green' is the original hand-drawn Tapatchi; the other
// seven come from the Figma team library, exported as real vector art.
export type TapatchiVariant =
  | 'green' | 'pink' | 'blue' | 'orange' | 'yellow' | 'white' | 'black' | 'purple';

export const TAPATCHI_VARIANTS: TapatchiVariant[] =
  ['green', 'pink', 'blue', 'orange', 'yellow', 'white', 'black', 'purple'];

// The designer's names for each character, shown in the UI where we want the
// character's own name rather than its colour.
export const VARIANT_DISPLAY_NAMES: Record<TapatchiVariant, string> = {
  green: 'Tapatchi',
  pink: 'Tapatchi',
  blue: 'Hisotchi',
  orange: 'Kikitchi',
  yellow: 'Mametchi',
  white: 'Fuwatchi',
  black: 'Gozarutchi',
  purple: 'Weeptchi',
};

// Characters whose artwork is inlined directly in the template (as SVG
// groups with per-part classes) rather than loaded as a flat <img>. This is
// what makes per-part animation (arms, ears, ...) possible instead of
// whole-character motion. Convert more variants here as they get rigged.
const RIGGED_VARIANTS: TapatchiVariant[] = ['green', 'pink'];

// Which moods actually have their own artwork in Figma. Every character has
// happy + fainted; only black and purple were drawn with an excited pose.
const DRAWN_MOODS: Record<TapatchiVariant, TapatchiMood[]> = {
  green: [],   // green is inline SVG, not an asset — handled separately
  pink: ['happy', 'fainted'],
  blue: ['happy', 'fainted'],
  orange: ['happy', 'fainted'],
  yellow: ['happy', 'fainted'],
  white: ['happy', 'fainted'],
  black: ['happy', 'fainted', 'excited'],
  purple: ['happy', 'fainted', 'excited'],
};

// For a mood with no artwork, which drawn pose to reuse. The difference is
// then carried by animation + colour treatment in the stylesheet, the same
// way the original green Tapatchi tints its body per mood.
const MOOD_FALLBACK: Record<TapatchiMood, TapatchiMood> = {
  happy: 'happy',
  normal: 'happy',
  excited: 'happy',   // only used when the character has no excited pose
  sad: 'happy',
  starving: 'happy',
  sleeping: 'happy',
  fainted: 'fainted',
};

// Egg #1..#8 on the selection screen, in the order they appear there. The
// gradients on that screen were already colour-coded per character.
const EGG_ID_TO_VARIANT: Record<number, TapatchiVariant> = {
  1: 'pink', 2: 'blue', 3: 'green', 4: 'yellow',
  5: 'purple', 6: 'orange', 7: 'white', 8: 'black',
};

/** Which character hatches from egg #id on the selection screen. */
export function variantForEggId(id: number): TapatchiVariant {
  return EGG_ID_TO_VARIANT[id] ?? 'green';
}

/**
 * Resolves whatever is stored in `petState.selectedEgg` to a variant.
 *
 * Older saves stored the egg's label ('Mystery #3') rather than a colour, and
 * the seeded demo user stores 'pink', so this accepts both and falls back to
 * green for anything unrecognised.
 */
export function resolveVariant(selectedEgg: string | null | undefined): TapatchiVariant {
  const raw = (selectedEgg ?? '').trim().toLowerCase();
  if (!raw) {
    return 'green';
  }
  if ((TAPATCHI_VARIANTS as string[]).includes(raw)) {
    return raw as TapatchiVariant;
  }
  const numbered = raw.match(/#\s*(\d+)/) ?? raw.match(/(\d+)/);
  if (numbered) {
    const mapped = EGG_ID_TO_VARIANT[Number(numbered[1])];
    if (mapped) {
      return mapped;
    }
  }
  return 'green';
}

@Component({
  selector: 'app-tapatchi',
  templateUrl: './tapatchi.component.html',
  styleUrls: ['./tapatchi.component.scss'],
  standalone: false,
})
export class TapatchiComponent {
  @Input() mood: TapatchiMood = 'happy';
  @Input() size: number = 200; // Default 200px
  @Input() animated: boolean = true; // Enable/disable idle animation

  // Leave unset to follow whichever egg the user hatched. Pass a value
  // explicitly for previews (egg selection, "how it works", evolution compare).
  @Input() variant?: TapatchiVariant;

  constructor(private pet: PetService) {}

  get resolvedVariant(): TapatchiVariant {
    return this.variant ?? resolveVariant(this.pet.state.selectedEgg);
  }

  // Rigged characters (green, pink, ...) are drawn inline with per-part
  // classes so they can animate arms/ears/etc individually; everyone else
  // still renders from their exported flat <img> art.
  get isRigged(): boolean {
    return RIGGED_VARIANTS.includes(this.resolvedVariant);
  }

  get isPlainArt(): boolean {
    return !this.isRigged;
  }

  /** Which drawn pose (happy/fainted/...) a rigged character should show. */
  get resolvedPose(): TapatchiMood {
    const drawn = DRAWN_MOODS[this.resolvedVariant];
    return drawn.includes(this.mood) ? this.mood : MOOD_FALLBACK[this.mood];
  }

  /** Path to the artwork for the current variant + mood (plain-art characters only). */
  get artSrc(): string {
    return `assets/tapatchi/${this.resolvedVariant}-${this.resolvedPose}.svg`;
  }

  /** True when the pose is reused, so the stylesheet knows to add the tell. */
  get isFallbackPose(): boolean {
    return !DRAWN_MOODS[this.resolvedVariant].includes(this.mood);
  }

  get displayName(): string {
    return VARIANT_DISPLAY_NAMES[this.resolvedVariant];
  }

  // Computed sizes (proportional to main size)
  get cheekRadius(): number { return this.size * 0.075; }
  get eyeRadius(): number { return this.size * 0.03; }
  get bodyRadius(): number { return this.size * 0.4; }
}
