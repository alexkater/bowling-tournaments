# UI Design Rules

## Design Philosophy
- Ultra-professional, premium SaaS look. Never "AI-generated" generic.
- Attention-grabbing but refined. Dark, sophisticated bowling aesthetic.
- No emojis in UI. Icons via lucide-react only.
- Typography-forward. Clean hierarchy. Inter for body, consider a display font for headings.

## Color Palette
- Avoid Tailwind's default warm palettes (amber, orange) — they look generic.
- Use custom, bowling-inspired tones: deep mahogany, slate blues, polished aluminum, pin-white.
- Dark backgrounds with high-contrast accents. Bowling alleys are dark environments.
- Define all custom colors via CSS custom properties in `:root` for Tailwind v4 compatibility.

## Components
- Cards: clean borders, subtle shadows, no gradient borders.
- Buttons: solid, confident. Primary = dark/blue, secondary = outline.
- Forms: generous padding (py-3 minimum), rounded-xl, clear focus states.
- Navigation: sticky, minimal, with subtle backdrop blur.

## Layout
- Max width 6xl (72rem) for content.
- Generous vertical spacing (py-20+ for sections).
- Grid-based feature sections with icons from lucide-react.

## Visual Quality Checks (before shipping)
- [ ] Body background is visible and intentional (not transparent)
- [ ] Heading font size ≥ 3xl (30px) for hero, ≥ 2xl for sections
- [ ] All interactive elements have hover states
- [ ] Form inputs have visible focus rings
- [ ] Color contrast passes AA (4.5:1 for text)
- [ ] No raw emojis in the DOM
