# Week by Week Parenting™ · by Aasthaxp

> Helping ordinary parents raise extraordinary humans—one week at a time.

A premium static site for the Week by Week Parenting brand: weekly parenting mission
cards, the seven growth pillars, printable nursery wall cards, and a full week-by-week
navigator for Stage 1 (Birth–6 Months).

## Live site

Published with GitHub Pages from the `main` branch, root folder.

## Stack

Pure HTML, CSS and vanilla JavaScript. No frameworks, no build step, no package
manager. The only external dependency is Google Fonts (Poppins + Inter).

| File | Purpose |
| --- | --- |
| `index.html` | All ten page sections, semantic markup, static Week 14 card as the no-JS fallback |
| `styles.css` | Design tokens, layout, components, print styles |
| `script.js` | Week data for all 26 weeks, card renderer, navigator, scorecard, persistence |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is, without Jekyll processing |

## Features

- Horizontal week navigator, weeks 1–26, keyboard accessible (arrow keys, Home, End)
- Complete mission card per week: goals, Minimum/Better/Best checklists, Mom, Dad and
  Family missions, Free/Budget/Premium options, what to avoid, red flags, Science
  Corner, Values Corner, scorecard, memory page and a tear-off mission card
- Checkbox ticks, scorecard ratings and memory-page notes persist for the browser
  session, stored per week
- Fade-in on scroll via `IntersectionObserver`, with `prefers-reduced-motion` respected
- Print stylesheet that isolates the tear-off mission card

## Locking the weeks again

All 26 weeks are currently unlocked as a limited-period promotion. To re-lock:

1. In `script.js`, set `UNLOCK_ALL = false` (near the top, section 02).
2. Optionally remove the `.unlock-banner` block from `index.html`.

Every week except the featured one (Week 14) then renders the teaser card instead.
No other changes are needed.

## Local development

No server required — open `index.html` directly in a browser. If you prefer a local
server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Disclaimer

Educational content only. Nothing here is a substitute for advice from your
paediatrician.

---

© Week by Week Parenting™ · by Aasthaxp. All rights reserved.
