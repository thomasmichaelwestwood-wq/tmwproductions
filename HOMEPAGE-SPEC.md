# TMW Productions — Homepage Concept: Full Reproduction Spec

A complete handoff document for rebuilding the "dark grey + black" homepage
concept in any AI model, tool, or codebase. Self-contained: prompt, design
tokens, section spec, signature effects, dependencies, and full source.

- **Live preview:** https://www.tmwproductions.co.uk/concept-slate.html
- **Brief:** engage a visitor fast without overwhelming them — minimal copy,
  big emotional photography, one repeated call-to-action.
- **Chosen direction:** dark grey canvas + black feature sections, purple as a
  jewel accent only.

---

## 1. Ready-to-paste prompt (for another AI model)

> Build a single-page, dark-luxury homepage for a wedding & events DJ (TMW
> Productions, Leicestershire UK). The goal: **engage a visitor fast without
> overwhelming them** — minimal copy, big emotional photography, one repeated
> call-to-action ("Check Your Date"). It's one quick vertical scroll of 7 short
> sections. Colour scheme: **dark grey canvas (#27272d) with true-black feature
> sections (#0b0b0d)**, and **purple used only as a jewel accent** (never as a
> fill). Headings in a brush-script display font; body in a clean light sans.
> Include filmic grain, a slow Ken Burns zoom on the hero, scroll-reveal
> animations, a soft purple glow behind the headline, and a subtle glow-pulse on
> the primary button. All motion must respect `prefers-reduced-motion`.
> Mobile-responsive. Sections in order: sticky nav → full-viewport hero →
> occasions ribbon → trust strip → 3 value cards → one big review → "meet the
> DJ" split → final CTA → footer.

---

## 2. Design tokens (brand system)

```
COLOURS
--purple-clarity : #722E80   primary purple — CTAs, links
--purple-mist    : #BA8DBD   accent — eyebrows, icons, highlights
--white          : #FFFFFF   body text (f5f0f7 also acceptable)
--black (canvas) : #27272d   dark grey page background  ← the key choice
--ink (feature)  : #0b0b0d   true black for contrast sections
card panel       : #292930
occasions strip  : #141417
text on dark     : rgba(245,240,247, 0.82–0.90)

TYPE
--font-display : brush-script / handwritten
                site font "Bitcheese"; web equivalent "Caveat" or "Pacifico"
--font-body    : light geometric sans
                site font "Gotham Light"; web equivalent "Jost" or "Montserrat 300"
Eyebrows : 0.68–0.72rem, letter-spacing 0.24–0.28em, UPPERCASE, purple-mist
Headings : clamp() fluid sizing, line-height ~1.0–1.1
Body     : 0.9–1.05rem, weight 300, line-height 1.6–1.8, ~85% opacity

SPACING / SHAPE
Section padding : clamp(5rem,10vw,8rem) vertical, 6% horizontal
Content widths  : hero 860px, cards grid 1100px, centred text 560–760px
Corners         : ≤16px (never overly rounded)
Rules           : no gradients on text, no heavy text-shadow,
                  purple is an accent not a fill, give elements room to breathe
```

---

## 3. Section-by-section spec

| # | Section | Purpose | Content |
|---|---------|---------|---------|
| — | **Topbar + sticky nav** | Wayfinding | Email + socials (topbar); logo, 5 links + "Book Now" pill (nav) |
| 1 | **Hero** (100vh) | Instant emotional hook | Full-bleed dance-floor photo, dark veil, eyebrow "Multi Award-Winning · Leicestershire", huge headline *"A dance floor that never empties"* (last 2 words purple), one-line subhead, primary CTA + ghost link, scroll cue |
| 2 | **Occasions ribbon** | "You're welcome too" | Label "For every occasion" + Weddings · Birthday Parties · Corporate Events · Anniversaries · Kids' Discos |
| 3 | **Trust strip** | Credibility in one line | TWIA 2024 & IDO 2026 Winner · 25+ years · 5-star reviewed |
| 4 | **Value trio** (black band) | What you get, minimal | 3 image cards — 01 The Music / 02 The Moment / 03 The Ease, one line each; lead line "No packages to decode. No agency…" |
| 5 | **Big review** | Social proof | One 5-star quote over a dimmed photo (not a wall of reviews) |
| 6 | **Meet the DJ** | Human trust | 50/50 split: portrait + short "Hi, I'm Tom" paragraph |
| 7 | **Final CTA** | Convert | Full-bleed photo, "Let's check your date", primary button |
| — | **Footer** | Links + contact | Logo, tagline, explore links, contact + Book Now |

**Design principle:** what a visitor *needs* to decide is above the fold;
everything they might *want* is one click away on deeper pages. Big type, lots of
whitespace, one recurring action.

### Copy (final, all sections)
- **Eyebrow:** Multi Award-Winning · Leicestershire
- **Headline:** A dance floor that never empties
- **Subhead:** Weddings, parties and events across the East Midlands, run by one DJ who reads the room and keeps it moving.
- **Primary CTA:** Check Your Date  ·  **Ghost link:** See how it works →
- **Occasions:** For every occasion — Weddings · Birthday Parties · Corporate Events · Anniversaries · Kids' Discos
- **Trust:** TWIA 2024 & IDO 2026 Winner · 25+ years behind the decks · 5-star reviewed
- **Value lead:** No packages to decode. No agency. Just *the right music, at the right moment*, all night long.
- **Card 01 The Music:** Your must-plays, your no-gos, and a room read live on the night.
- **Card 02 The Moment:** Your night, built around you — whether it's a first dance or a full-on party.
- **Card 03 The Ease:** One planning portal, one person, zero chasing. Simple from day one.
- **Review:** "He read the room to perfection — despite it being the hottest Saturday of the year, the dance floor was never empty. A truly personalised service, with no glitches." — Wedding Client · Leicestershire
- **Meet Tom:** 25 years reading dance floors — weddings, parties, corporate nights, the lot. When you book TMW, you're booking a personal, quality-controlled service — never an agency, never a stranger.
- **Final CTA:** Let's check your date / Tell me when and where — I'll come back within 24 hours.

---

## 4. Signature effects ("the pop")

1. **Filmic grain** — fixed SVG `feTurbulence` noise layer, `opacity: 0.05`, `mix-blend-mode: overlay`, `z-index` above content, `pointer-events: none`.
2. **Photo colour-grade** — a `soft-light` purple-tint gradient over every image so mixed photography (cool/warm/sepia) reads as one set.
3. **Ken Burns** — hero image `scale(1) → scale(1.08)` over 24s, ease-in-out, alternating.
4. **Headline glow** — a blurred radial purple circle behind the H1.
5. **Scroll-reveal** — elements start `opacity:0; translateY(34px)`; IntersectionObserver adds `.is-in`; staggered with `data-d="1|2|3"` transition delays.
6. **CTA glow-pulse** — primary button box-shadow breathes purple on a 3.4s loop.
7. **Micro-interactions** — cards zoom their background image on hover; ghost links widen letter-spacing on hover.
8. **Accessibility** — all animation disabled under `prefers-reduced-motion: reduce`; skip-link; visible keyboard focus rings.

---

## 5. Dependencies (to make it standalone)

The concept file leans on shared site assets. Hand these over too, or rebuild
from the tokens above:

- **`css/style.css`** — CSS variables, the `.topbar` / `.nav` / `.footer` / `.btn`
  components, and `@font-face` for Bitcheese + Gotham.
- **Font Awesome 6.5.0** (CDN) — icons.
- **Images** — `QuornShootEdited-173.jpg` (hero + cards + final CTA),
  `IMG_0628.jpg` (review background), `tom-westwood.jpg` (portrait + card 03),
  `TMW_Full_PurpleWhite.webp` (logo), `favcon.png` (favicon).
- **`js/main.js`** — nav scroll behaviour + hamburger menu (the scroll-reveal
  script is inline in the page).

### If rebuilding fully standalone (no shared CSS)
Recreate these minimal components from the tokens: a fixed topbar (email +
socials), a sticky nav that gains a blurred background on scroll, a rounded
white "Book Now" pill button, and a 3-column footer. Swap Bitcheese→Caveat and
Gotham→Jost via Google Fonts. Replace the five images with your own or
placeholders.

---

## 6. Full source code

The complete, current implementation lives at `concept-slate.html` in this
repository. The purple-based alternative is `concept.html`. Both share the same
structure and differ only in the base-colour tokens (see §2).

Key structural notes for a faithful rebuild:
- Scoped class prefix `c-` keeps all concept styles isolated.
- The page background is set by overriding `--black` locally on `.c-body`
  (`--black: #27272d`) and adding `--ink: #0b0b0d` for the black value band.
- Each photographic section layers, back to front:
  `image → colour-grade → veil/overlay → content`.
- Section vertical rhythm alternates grey canvas ↔ black/photo blocks for
  definition.

> To reproduce elsewhere, copy `concept-slate.html` verbatim, then either bring
> the dependencies in §5 or inline equivalents. Everything visual is contained
> in the page's `<style>` block plus the token overrides on `.c-body`.
