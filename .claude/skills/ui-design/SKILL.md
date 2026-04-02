---
name: ui-design
description: >
  Apply TMW Productions brand guidelines when building or editing the website.
  Use this skill for all HTML/CSS work on the site.
---

## Brand Identity

TMW Productions is an award-winning wedding DJ and event host based in
Leicestershire. The brand is **premium, warm, and trustworthy** — not cold or
corporate. Everything should feel like a luxury service that a real person runs
with care.

## Core Aesthetic: Dark Luxury

- **Mood**: Refined, confident, celebratory — like a high-end wedding venue at night
- **NOT**: Cold tech, generic agency, or overly "DJ nightclub"
- **Tone**: Personal warmth inside a professional shell

## Colour System (CSS variables already defined in `css/style.css`)

| Variable             | Value                  | Usage                                   |
|----------------------|------------------------|-----------------------------------------|
| `--black`            | `#0a0a0f`              | Primary background                      |
| `--white`            | `#f5f0f7`              | Body text                               |
| `--purple-clarity`   | `#722e80`              | Primary CTAs, featured elements         |
| `--purple-mist`      | `#ba8dbd`              | Accent — labels, icons, highlights      |
| `--purple-soft`      | `rgba(186,141,189,…)`  | Subtle backgrounds, borders             |

**Never** introduce new colours. Use the existing system only.

## Typography (CSS variables)

- `--font-display`: `'Cormorant Garamond'` — headings, labels, eyebrows, prices
- `--font-body`: `'Jost'` — all body copy and UI text
- Eyebrow labels: `0.7–0.75rem`, `letter-spacing: 0.2–0.25em`, `text-transform: uppercase`
- Section titles: `2–2.5rem`, `letter-spacing: 0.05–0.1em`
- Body text: `0.9–1rem`, `line-height: 1.7–1.8`, `opacity: 0.8–0.85`

## Spacing Principles

- **Give elements room to breathe.** Cramped = cheap. Premium = space.
- Section padding: `5rem 5%` (top/bottom at least `4rem`)
- Between siblings: use `gap`, not `margin-bottom` stacking
- Max content widths: `1100px` for feature layouts, `800–900px` for card grids, `600–700px` for centred text
- Never let text run full viewport width

## Component Patterns (match existing pages)

### Package / Option Cards (see `weddings.html`)
```
border: 1px solid rgba(186,141,189,0.25)
padding: 2.5rem
hover: translateY(-4px), border-color: var(--purple-mist)
featured: border-color: var(--purple-mist) + rgba(186,141,189,0.08) background
```

### Section Label / Eyebrow
```html
<span class="section__label">Label Text</span>
```
Small uppercase purple text that appears above every section heading.

### Feature Rows (alternating image/text — see `planning-portal.html`)
Two-column grid, image one side, text the other, alternating layout per row.

### Award Strip
Dark horizontal band with 3 trust-signal items — used near the top of pages.

### CTA Banner
Full-width `cta-banner` section at the bottom of pages before the footer.

## Writing Style for UI Copy

- Short, direct, confident — no waffle
- Second person ("you", "your") — personal and warm
- No exclamation marks — conveys premium without desperation
- Feature descriptions: lead with the benefit, not the feature name

## What to Avoid

- Gradients on text (not on brand)
- Rounded corners above `20px` (feels too soft/consumer)
- Heavy drop shadows on text
- Generic stock-photo aesthetics
- Overuse of purple — it's an accent, not a primary fill
- Adding inline styles when a CSS class already handles it
- Creating new CSS files — add styles to the page's `<style>` block or `css/style.css`
- Placeholder/Lorem text — always use realistic copy
