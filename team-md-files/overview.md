# PAYOGOTCHI PROJECT CONTEXT

## PROJECT OVERVIEW

**Project Name:** BIPJ-NETS (NETS App Reimagined)
**Course:** Business Innovation Project (BIPJ) at Nanyang Polytechnic (NYP)
**Team Lead:** Calvin
**Team Members:** Calvin (Payogotchi), Eron (AI Travel Concierge), Yunen (Quests/Rewards), Others

## PROJECT PURPOSE

This is a redesign of Singapore's NETS payment app targeting Gen Z and Millennials. The core innovation is transforming NETS from a boring utility payment app into an emotional daily companion through gamification.

The project addresses these NETS problems:
- ❌ No rewards/cashback ecosystem
- ❌ No social features
- ❌ No budget tracking
- ❌ No lifestyle integration
- ❌ No personalization
- ❌ No financial insights
- ❌ Low daily engagement
- ❌ Weak UX/UI

## PAYOGOTCHI FEATURE OVERVIEW

Payogotchi is a Tamagotchi-inspired virtual pet gamification system integrated into the NETS app. Users raise a virtual pet (called a "Tapatchi") that grows and evolves through their NETS transactions. This creates emotional attachment, daily engagement, and habit formation around using NETS for payments.

## KEY CONCEPTS AND TERMINOLOGY

### System Names:
- **Payogotchi**: The overall gamification system/feature name
- **Tapatchi**: The species/name of the virtual pet character
- **NETS Points**: In-app currency earned from transactions
- **XP (Experience Points)**: Growth points that level up the pet

### Pet Character Design:
- Round green blob body (Kuchipatchi-inspired, similar to Tamagotchi)
- Vibrant green color (#9ED03B)
- Thick navy blue outline (#1E3A8A, 4-6px stroke)
- Two small dot eyes with white shine
- Two yellow blushed cheeks (#FFE066)
- Wide friendly smile
- Small stubby arms and legs

## THE 3 CORE METERS (Game Mechanics)

Every Tapatchi has 3 stats that work together:

### 1. XP (Experience Points) - Growth
- **Purpose:** Levels up the pet
- **How earned:** Transaction amount × 10 (base XP)
- **Formula:** Each level requires: Level × 100 XP
- **Daily caps by stage:**
  - Baby (Level 1-15): 200 XP/day max
  - Teen (Level 16-35): 400 XP/day max
  - Adult (Level 36+): 600 XP/day max
- **Purpose of cap:** Prevents rich users from dominating; rewards consistent usage
- Affected by Happiness multiplier (0.5x to 1.2x)

### 2. HUNGER - Survival
- **Purpose:** Keeps pet alive
- **Depletion rate by stage:**
  - Baby: -10/day
  - Teen: -15/day
  - Adult: -20/day
- **How to restore:** ONLY food category transactions restore hunger
  - Formula: Transaction × 2 = hunger restored
  - Capped at 40 per transaction
- **Consequences at 0:** Pet faints after 3 days at 0 hunger (never dies, always recoverable)

### 3. HAPPINESS - Multiplier
- **Purpose:** Affects XP gain rate
- **Depletion:** -5/day all stages
- **Boosters:** New merchant category (+10), daily login (+5), play mini-game (+10), complete challenge (+15)
- **Multiplier effect on XP:**
  - 80-100 (Very Happy): 1.2x XP
  - 50-79 (Normal): 1.0x XP
  - 20-49 (Sad): 0.8x XP
  - 0-19 (Depressed): 0.5x XP

## PET EVOLUTION STAGES

Users start by choosing 1 of 8 eggs. Each egg hatches into a specific baby character that grows through 3 stages:

- **Stage 1: BABY** (Level 1-15) - Small, cute, learning phase
- **Stage 2: TEEN** (Level 16-35) - Growing, more features unlock
- **Stage 3: ADULT** (Level 36+) - Full form, endgame prestige

## EGG SYSTEM

8 different eggs available at start:
1. Pink egg with white polka dots
2. Blue egg with stripes
3. Green egg with leaf pattern
4. Yellow egg with stars
5. Purple egg with galaxy swirls
6. Orange egg with flame pattern
7. White egg with cloud pattern
8. Black egg with diamond sparkles (marked RARE)

Each egg hatches into a specific character after user makes 5 NETS transactions.

## EGG RESTART SYSTEM (Trial Period + Penalty)

### Trial Period Rules:
- Active for FIRST 72 hours OR until user reaches Level 5
- Maximum 5 free swaps allowed
- No XP penalty
- All 5 swaps means user can try 6 of 8 eggs total

### After Trial Rules:
- 50% XP loss when swapping
- 30-day cooldown between swaps
- Cosmetics and achievements are kept
- Requires 2-step confirmation

## COMPLETE SCREEN LIST (21 SCREENS TOTAL)

### TIER 1: ESSENTIAL SCREENS (Core Flow)
1. **01_Egg_Selection** - First-time user picks their egg (8 eggs displayed)
2. **02_Hatching_Progress** - Shows 5-transaction hatching countdown
3. **03_Hatching_Animation** - Big egg-cracking reveal moment
4. **04_Naming_Screen** - First-time pet naming
5. **05_Payogotchi_Home** - Main pet interaction hub (MOST IMPORTANT SCREEN)
6. **06_Transaction_Feedback** - Popup after each transaction shows rewards
7. **07_Level_Up** - Celebration screen when leveling up
8. **08_Stage_Evolution** - Major milestone (Baby → Teen → Adult)
9. **09_Mini_Game** - Tap-game to boost happiness
10. **10_Pet_Settings** - Pet management menu

### TIER 2: EXTENDED SCREENS
11. **11_Egg_Reselection_Trial** - Free egg swap during trial period
12. **12_Egg_Reselection_Penalty** - Egg swap with 50% XP loss warning
13. **13_Fainted_Pet** - Pet fainted from hunger, needs food to revive
14. **14_Welcome_Back** - Joyful reunion after revive/return
15. **15_Tapatchi_Tutorial** - 6-slide onboarding tutorial
16. **16_Cosmetics_Dressup** - Wardrobe gallery for pet customization
17. **17_How_Payogotchi_Works** - Settings-based tutorial entry
18. **18_Cosmetic_Purchase_Modal** - Buy cosmetic confirmation popup
19. **19_Egg_Swap_Modal** - Confirm egg swap popup
20. **20_Rename_Pet** - Dedicated rename screen for existing pet
21. **21_Account_Settings** - NETS account settings menu

## COMPLETE USER FLOW

### FLOW 1: NEW USER ONBOARDING (Linear)
User opens NETS app for first time
↓
Screen 01 (Egg Selection) - Chooses 1 of 8 eggs
↓
Screen 02 (Hatching Progress) - Makes 5 NETS transactions
↓
Screen 03 (Hatching Animation) - Big reveal moment
↓
Screen 04 (Naming Screen) - Names the pet
↓
Screen 05 (Payogotchi Home) - Lands on main hub
↓
Screen 15 (Tutorial) - Optional walkthrough

### FLOW 2: DAILY USE
User opens Payogotchi tab (Screen 05)
↓
Sees pet, checks 3 meters
↓
Makes NETS transaction (simulated with demo buttons)
↓
Screen 06 (Transaction Feedback) - Popup shows +XP, hunger restored
↓
Returns to Screen 05 - Updated meters, happy pet

### FLOW 3: MILESTONE CELEBRATIONS
Home (05) → When XP threshold reached
↓
Screen 07 (Level Up) - Confetti, level up celebration
↓
Home (05) → When stage threshold reached (Level 15, 35)
↓
Screen 08 (Stage Evolution) - Dramatic transformation

### FLOW 4: PET CARE AND RECOVERY
Home (05) → Pet becomes hungry over days
↓
Screen 13 (Fainted Pet) - After 3 days at 0 hunger
↓
User makes food transaction
↓
Screen 14 (Welcome Back) - Joyful revival with bonus rewards
↓
Home (05)

### FLOW 5: SETTINGS AND MANAGEMENT
Home (05) → Tap Settings gear
↓
Screen 10 (Pet Settings) - Main settings menu
↓
Can access:

Screen 20 (Rename Pet)
Screen 11 (Egg Reselection Trial) OR Screen 12 (Egg Reselection Penalty)
→ Screen 19 (Egg Swap Modal)
→ Screen 02 (Hatching Progress) if confirmed
Screen 17 (How Payogotchi Works)
→ Screen 15 (Tutorial slides)
Screen 21 (Account Settings)


### FLOW 6: CUSTOMIZATION
Home (05) → Tap "Dress" button
↓
Screen 16 (Cosmetics Dressup) - Browse hats, accessories, backgrounds
↓
Tap item to purchase → Screen 18 (Purchase Modal)
↓
Confirm purchase → Return to Screen 16 with item equipped
## APP STRUCTURE (5 TABS)

The full NETS app has 5 bottom navigation tabs:
1. **Home** - Payment overview (NETS main functionality)
2. **Pay** - Send/receive money, QR scan
3. **Travel** - AI Travel Concierge (Eron's feature)
4. **Rewards** - Quests and rewards (Yunen's feature)
5. **Payogotchi** - The Payogotchi system (Calvin's feature - THIS PROJECT)

The Payogotchi tab (was formerly "Account") is where all 21 screens live.

## CURRENT CODEBASE STATUS

### What's Already Built:
- ✅ Ionic 8 + Angular project set up
- ✅ 5-tab navigation working
- ✅ Global theme configured (colors, fonts)
- ✅ TapatchiComponent (reusable pet character with 6 moods)
- ✅ Google Fonts imported (Fredoka, Inter, Quicksand)
- ✅ SCSS variables defined in src/theme/variables.scss

### What Still Needs Building:
- ❌ All 21 Payogotchi screens (currently only tab5 has test content)
- ❌ Pet state management service
- ❌ Transaction simulation service
- ❌ Navigation between Payogotchi screens
- ❌ Animation sequences (hatching, level up, evolution)

## TECHNICAL STACK

### Framework:
- **Ionic 8** (mobile UI framework)
- **Angular** (with standalone components)
- **TypeScript** for logic
- **SCSS** for styling
- **HTML** with Ionic components

### Character/Animation:
- **SVG** for pet character (already built)
- **CSS animations** for pet moods and simple effects
- **Angular animations** for page transitions
- No React, no Tailwind, no external animation libraries

### State Management:
- Angular services for shared state
- No NgRx or Redux for hackathon simplicity

## PROJECT FILE STRUCTURE



## DESIGN SYSTEM (CRITICAL - USE THESE VARIABLES)

All colors are defined in `src/theme/variables.scss`. NEVER hardcode hex values in components. Always use:

### Brand Colors:
- `--ion-color-primary` = NETS Red #E30613
- `--ion-color-secondary` = Payogotchi Blue #1E3A8A

### Payogotchi Colors:
- `--payogotchi-cream` = #FFF9F5 (main background)
- `--payogotchi-soft-pink` = #FFB6C1
- `--payogotchi-sky-blue` = #87CEEB
- `--payogotchi-mint` = #B2F2BB
- `--payogotchi-lemon` = #FFE066
- `--payogotchi-lavender` = #D4BBFF
- `--payogotchi-light-blue-accent` = #F0F4FF

### Meter Colors:
- `--xp-color` = #FFA500 (dark), `--xp-color-light` = #FFD700
- `--hunger-color` = #FF6B1A (dark), `--hunger-color-light` = #FF8C42
- `--happiness-color` = #FF4081 (dark), `--happiness-color-light` = #FF6B9D

### Tapatchi Character Colors:
- `--tapatchi-green` = #9ED03B
- `--tapatchi-outline` = #1E3A8A
- `--tapatchi-cheeks` = #FFE066

### Text Colors:
- `--text-primary` = #2D3436 (soft black)
- `--text-secondary` = #636E72 (medium grey)
- `--text-light` = #9E9E9E
- `--text-accent` = #E30613

### Style Variables:
- `--radius-small` = 12px
- `--radius-medium` = 16px
- `--radius-large` = 24px
- `--radius-xl` = 32px
- `--radius-pill` = 100px
- `--shadow-soft` = 0px 4px 12px rgba(0, 0, 0, 0.08)

## TYPOGRAPHY RULES

### Font Families:
- **Fredoka** - Headings, titles, celebratory text
- **Inter** - Body text, labels, buttons
- **Quicksand** - Pet names, cute text

### Size Guide:
- Headings: 24-32px, Fredoka Bold
- Body: 14-16px, Inter Regular/Medium
- Pet names: 22px, Quicksand Bold
- Small labels: 11-13px, Inter Medium

## CODING STANDARDS FOR THIS PROJECT

### Component Rules:
1. Always use standalone components (Angular 17+)
2. Import IonicModule and other dependencies
3. Follow naming: `KebabCasePage` for pages, `PascalCaseComponent` for reusable
4. Use `styleUrls` (not `styles`)
5. Use OnPush change detection when possible

### Ionic Component Preferences:
- Use `<ion-content>`, `<ion-header>`, `<ion-toolbar>` for structure
- Use `<ion-button>` not `<button>`
- Use `<ion-icon>` for icons
- Use `<ion-list>` and `<ion-item>` for lists
- Use `<ion-card>` for card layouts
- Use `<ion-modal>` for modals

### SCSS Rules:
1. Use CSS custom properties (var()) not SCSS variables for colors
2. Use existing variables from src/theme/variables.scss
3. Use kebab-case for class names
4. Prefix component-specific classes with component name
5. Do NOT use Tailwind utility classes
6. Do NOT use CSS-in-JS

### File Naming:
- Pages: `[name].page.ts`, `[name].page.html`, `[name].page.scss`
- Components: `[name].component.ts`, `[name].component.html`, `[name].component.scss`
- Services: `[name].service.ts`

## IMPORTANT: WHAT NOT TO DO

### DO NOT:
- ❌ Use React syntax or JSX
- ❌ Use Tailwind CSS classes
- ❌ Use CSS-in-JS or styled-components
- ❌ Modify files outside of Payogotchi feature
- ❌ Modify main Ionic navigation (tabs.page.ts, tabs-routing.module.ts)
- ❌ Hardcode color hex values (use CSS variables)
- ❌ Create React components (use Angular components)
- ❌ Use `className` (use `class` in Angular)
- ❌ Modify teammates' work (Eron's travel, Yunen's rewards)
- ❌ Change the TapatchiComponent (it's finalized)
- ❌ Change global theme variables without asking

### DO:
- ✅ Use Ionic Angular standalone components
- ✅ Use SCSS with CSS custom properties
- ✅ Reuse the TapatchiComponent for the pet character
- ✅ Follow the folder structure at src/app/pages/payogotchi/
- ✅ Use the design system variables from variables.scss
- ✅ Match the visual style shown in Figma
- ✅ Ask before creating new services or modifying shared code
- ✅ Show code before creating files

## FILES YOU CAN FREELY MODIFY:
- `src/app/pages/payogotchi/**/*` (all Payogotchi screens)
- `src/app/services/pet.service.ts` (create if needed)
- `src/app/services/transaction.service.ts` (create if needed)
- `src/app/models/pet.model.ts` (create if needed)

## FILES TO ASK BEFORE MODIFYING:
- `src/theme/variables.scss` (global theme - only add, don't change existing)
- `src/app/components/tapatchi/*` (finalized character component)
- `src/app/tabs/tabs.page.ts` (bottom navigation)
- `src/index.html` (global scripts and fonts)
- `angular.json` and `ionic.config.json`
- `package.json`

## FILES YOU MUST NOT TOUCH:
- Any files in `src/app/tab1/`, `src/app/tab2/`, `src/app/tab3/`, `src/app/tab4/` (other team members)
- `.git/` directory
- `node_modules/`

## FIGMA MCP WORKFLOW

When I share a Figma frame link with you:

1. **Read the design first** using get_design_context
2. **Get visual reference** using get_screenshot
3. **Translate to Ionic Angular** - never leave as React/Tailwind
4. **Show me the code** before creating files
5. **Use existing patterns** - check similar existing files first
6. **Reuse components** - especially TapatchiComponent
7. **Match design system** - use variables.scss for colors

## PROJECT DEADLINE

This is a 6-week project. Currently in Week 1-2 of implementation phase. Prioritize:
1. Core screens first (Home, Egg Selection, Hatching)
2. Then daily use screens (Transaction Feedback, Mini-Game)
3. Then milestone screens (Level Up, Evolution)
4. Then extended features (Cosmetics, Settings)
5. Polish and animations last

## PROJECT SUCCESS CRITERIA

For the module grade, the Payogotchi feature should demonstrate:
- ✅ Complete new user onboarding flow works
- ✅ Pet responds to transactions
- ✅ Meters update correctly
- ✅ Multiple screens interconnect smoothly
- ✅ Visual polish matches Figma design
- ✅ Character animations feel alive
- ✅ Code is clean and organized


What Phase 2 is

The celebration chain — the demo's money-shot. A transaction now drives UI off the TransactionResult from Phase 1, instead of silently mutating state.

What I implemented (all in payogotchi-home, house-convention inline ion-modal)

Orchestration (.page.ts)
- runTransaction() calls applyTransaction(), stores the result, and opens the
- (didDismiss) handlers chain it: Feedback (always) → Level Up (if result.leveledUp) → Evolution (if result.evolved). Each modal opens only after the previous one finishes dismissing, so they never fight.

Three inline modals (.page.html) — reusing the existing Level-Up / Evolution visuals (rings, sunburst, app-tapatchi, before→after), all bound to real data:
- 06 Feedback: merchant, +XP, +Hunger/+Happiness (only when non-zero), +NETS Pnote if xpCapped, and a revive line if revived.
- 07 Level Up: level before → now + points.
- 08 Evolution: from → to stage + stage unlocks.

Manual demo control kept: the Home "Level Up" / "Evolve" buttons now open thosdata) instead of routing away — so you can force-show either on stage.

Styling (.page.scss) — self-contained celebration styles, theme variables only (no hardcoded palette except two pre-existing-style gradient stops matching the existing pages).

How it plays in your demo

Returning user (720/800 XP, happiness 90) taps 🍜 Lunch $12 → 144 XP → Feedback modal pops (+144 XP, +24 Hunger, +3 Happiness, +12 NETS Points) → tap Continue → Level Up modal chains automatically (8 → 9). That's the core loop, live.                                                                                                                                    
Notes                                                                                                                                                                                 
- The old level-up / stage-evolution / transaction-feedback route-pages still exist as a fallback; per spec their routes can be dropped later — I left them to avoid churn before the demo.
- merchant now flows through applyTransaction() into the feedback text (it was the unused param from Phase 1).

Want me to launch the app and screenshot the Lunch → Feedback → Level-Up chain before moving to Phase 3 (the OnboardingGuard is partly done already via theentry guard, plus the fainted-state render and the "simulate a day" decay button)?








All three are done and the build is green. Here's what changed.

1. Reset XP cap + reach Level 10

- New PetService.resetDailyXpCap() — clears today's dailyXpEarned (simulates a fresh day).
- New Home demo button ♻️ Reset XP Cap (shows a "cap reset" toast).
- Reshaped the returning-user seed so the story lands crisply: Lv 9, 780/900 XP, already at today's cap (200/200).

The demo now plays in 2 taps:
1. Tap 🍜 Lunch → XP is blocked by the cap → top toast "Daily XP cap reached" (no celebration modal, since 0 XP earned).
2. Tap ♻️ Reset XP Cap → tap 🍜 Lunch again → +144 XP → 924/900 → Feedback modal → Level Up modal (9 → 10) chains automatically.

2. Cap message is now a top toast


3. Egg-selection reachability — you weren't doing it wrong

It's the guard working as designed: once onboarded is true (which "Returning user" sets), the Payogotchi tab always routes to Home, so the intro→egg flow is intentionally hidden. To replay it without typing URLs:
- New Home demo button 🥚 New User → resets to a fresh new user and jumps to /tabs/payogotchi → guard → intro → "Start your journey" → egg-selection.
- (The /tabs/payogotchi/dev page's "New user" button does the same.)

So egg-selection is reached through the intro, not directly — tap 🥚 New User on Home and you're in that flow.

One note: the returning-user demo now shows 9 → 10 instead of the old 8 → 9. If you'd rather demo an uncapped first level-up too, I can seed dailyXpEarned: 0 so the first tap levels up immediately and the cap/reset comes after — just say the word. Want me to launch the app and screenshot the cap-toast → reset → Level 10 sequence?