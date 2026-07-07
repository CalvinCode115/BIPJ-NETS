I'm building the Egg Selection screen for my Payogotchi 
feature. Here's the Figma design:

Implement this design from Figma.
@https://www.figma.com/design/ZtD7NgqXMQFimh9BJjCaBQ/240311c-s-team-library?node-id=4781-429&m=dev 

IMPORTANT CONTEXT:
- This project uses Ionic 8 with Angular (standalone 
  components), not React or Tailwind
- SCSS for styling, not CSS-in-JS
- The page should be created at src/app/pages/egg-selection/
- Use existing SCSS variables from src/theme/variables.scss
- Reuse the existing TapatchiComponent at 
  src/app/components/tapatchi/ if the pet is shown
- Follow Ionic 8 conventions (ion-header, ion-content, 
  ion-toolbar, etc.)

Please:
1. Use get_design_context to read the frame structure
2. Use get_screenshot to see the visual reference
3. Generate the complete Ionic Angular page with:
   - .ts file (standalone component with proper imports)
   - .html file (using Ionic components)
   - .scss file (using existing theme variables)
4. Include navigation logic to move to the next screen 
   when an egg is selected
5. Do NOT output React or Tailwind — translate everything 
   to Ionic + Angular + SCSS

Save the files but let me review before creating routes.