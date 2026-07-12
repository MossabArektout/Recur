# Recur — Design & UI/UX Reference

## 1. Concept

Recur's job is to turn financial anxiety ("what am I secretly paying for?") into calm clarity. The design should feel like a **well-kept ledger, not a warning system** — reassuring and precise, never alarmist or gamified.

**Signature element:** subscriptions are displayed as **receipt-tape rows** — a nod to what they actually are (recurring receipts). Amounts are right-aligned in monospace like a real receipt printout, rows are separated by a thin dotted "perforation" line, and the dashboard total sits inside a torn-edge receipt card at the top. This is the one distinctive, memorable device — everything else stays quiet and disciplined around it.

**Tone:** plain, direct, calm. No shame-based language ("You're wasting money!"), no gamification badges. The app states facts and lets the user decide.

---

## 2. Design Tokens

### Color

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F6F5F1` | App background — cool-toned off-white, not cream |
| `--ink` | `#1C2530` | Primary text, deep navy-black |
| `--ink-soft` | `#5A6472` | Secondary text, labels |
| `--line` | `#D8D5CC` | Dividers, perforation lines, borders |
| `--accent-safe` | `#4F7A68` | Muted sage green — subscription is fine, renewal far away |
| `--accent-upcoming` | `#C98A2E` | Warm amber — renewing within 7 days |
| `--accent-urgent` | `#C4472A` | Muted brick red (not neon) — trial ending / renewing within 48h |
| `--surface-card` | `#FFFFFF` | Card backgrounds on top of paper |
| `--surface-pro` | `#1C2530` | Dark surface used only for the Pro paywall screen, to make it feel distinct/premium |

Do not use pure black (#000) or pure white (#FFF) anywhere except `--surface-card`. Do not introduce a bright neon accent — the brick-red and amber are intentionally muted so the app reads calm, not alarming.

### Typography

- **Display / headers:** `General Sans` or `Inter Display` (semi-bold, tight tracking) — clean geometric sans, used sparingly for screen titles and the dashboard total figure.
- **Body / UI text:** `Inter` (regular/medium) — all labels, buttons, descriptions.
- **Numerals / amounts / dates:** `IBM Plex Mono` or `JetBrains Mono` — every price, every date, every renewal countdown uses this. This is what makes rows read like a receipt. Non-negotiable — do not render prices in the sans font.

Type scale:
- Screen title: 28px / semi-bold / `--ink`
- Section label (eyebrow): 12px / uppercase / letter-spacing 0.08em / `--ink-soft`
- List item name: 16px / medium / `--ink`
- List item amount: 16px / mono / `--ink`
- Body / helper text: 14px / regular / `--ink-soft`
- Dashboard total figure: 40px / mono / semi-bold / `--ink`

### Layout & spacing

- Base spacing unit: 4px. Use multiples (8, 12, 16, 24, 32).
- Card corner radius: 12px (soft but not bubbly — avoid 20px+ radii, they read as "generic app template")
- Card border: 1px solid `--line`, no drop shadows except a very subtle one (`0 1px 3px rgba(0,0,0,0.04)`) — this is a flat, paper-like design, not a floating-card design.
- Perforation divider between list rows: dashed 1px `--line`, not a solid rule — reinforces the receipt-tape motif.

### Motion

Minimal and functional only:
- List item entering (new subscription added): slide down + fade, 200ms
- Total figure on dashboard: when it changes, a quick count-up animation (300ms) — this is the one moment worth polishing since it's the emotional payoff of the app
- No decorative animation elsewhere. No confetti, no bouncing icons, no gamified celebration on completing an action.

---

## 3. Screen-by-screen layout

### 3.1 Dashboard (Home)

```
┌─────────────────────────────────┐
│  RECUR                    ⚙︎     │  <- title bar, settings icon right
│                                   │
│  ┌ - - - - - - - - - - - - - ┐  │
│  ┆   YOU'RE SPENDING          ┆  │  <- torn-edge receipt card
│  ┆   $84.32 / month           ┆  │     mono, 40px, count-up on change
│  ┆   $1,011.84 / year         ┆  │
│  └ - - - - - - - - - - - - - ┘  │
│                                   │
│  UPCOMING                        │  <- eyebrow label
│  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │
│  Netflix            $15.49  ●    │  <- ● = colored dot, accent-safe/upcoming/urgent
│  renews in 4 days                │
│  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │
│  Notion Pro (trial)  $10.00  ●   │
│  trial ends in 2 days            │
│  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │
│  ...                             │
│                                   │
│                            [ + ] │  <- floating add button, bottom right
└─────────────────────────────────┘
```

- List sorted soonest-renewal-first, always.
- Colored dot (not a full colored row/badge — keep it subtle) uses the three accent colors from the token table based on days-to-renewal.
- Trial items always show "trial ends in X days" instead of "renews in X days," and use accent-urgent once inside 3 days regardless of the normal threshold.

### 3.2 Add / Edit Subscription

Single-column form, generous spacing, one field per row — this is a data-entry screen, don't cram it.

```
┌─────────────────────────────────┐
│  ←  Add subscription             │
│                                   │
│  Name                            │
│  [ Netflix                    ]  │
│                                   │
│  Cost                Currency    │
│  [ 15.49    ]        [ USD ▾ ]   │
│                                   │
│  Billing cycle                   │
│  [ Monthly ▾ ]                   │
│                                   │
│  Next renewal date               │
│  [ 12 Aug 2026            📅]    │
│                                   │
│  Category                        │
│  [ Streaming ▾ ]                 │
│                                   │
│  ◻ This is a free trial          │  <- checkbox reveals trial_end_date below
│                                   │
│  Notes (optional)                │
│  [                            ]  │
│                                   │
│  [        Save subscription    ] │  <- full-width primary button, --ink bg
└─────────────────────────────────┘
```

### 3.3 Subscription Detail

Opens on tapping a list row. Shows the same fields read-only with an Edit and Delete action, plus a small renewal-history strip if there's any (v2). Keep this screen simple in v1 — mainly Edit/Delete plus the mono-styled amount and date prominently at top.

### 3.4 Paywall

The one screen allowed to break from the paper-light palette — uses `--surface-pro` (dark) to feel like a distinct, premium moment.

```
┌─────────────────────────────────┐
│           Dark background        │
│                                   │
│      Unlock unlimited tracking   │
│                                   │
│   You're tracking 5 of 5 free    │
│   subscriptions.                 │
│                                   │
│   ✓ Unlimited subscriptions      │
│   ✓ Spend analytics by category  │
│   ✓ Monthly trend chart          │
│                                   │
│   [  $2.99/month  ] [ $14.99/yr ]│  <- two tappable price cards
│                                   │
│   [     Start free trial      ]  │  <- if offering a trial on Pro itself
│   Restore purchase               │
└─────────────────────────────────┘
```

### 3.5 Analytics (Pro only)

Simple bar chart, category breakdown by monthly spend, using the same accent palette for category colors (extend with 2-3 more muted tones if needed — don't introduce bright chart-default colors like default Chart.js blue/orange).

### 3.6 Settings

Plain list: Currency, Reminder lead time (default 3 days), Manage subscription (opens RevenueCat/store restore flow), About.

---

## 4. Component notes

- **Buttons:** primary = solid `--ink` background, `--paper` text, 12px radius, no gradient, no shadow. Secondary = outline only, 1px `--line`.
- **Empty state (no subscriptions yet):** don't just say "No subscriptions." Say something like "Nothing tracked yet — add your first subscription to see what you're really spending." This is the interface's voice, not a generic placeholder.
- **Error states:** be specific. "Renewal date can't be in the past" not "Invalid input."
- **Notification copy:** "Netflix renews in 3 days — $15.49" not "Reminder: subscription update." Always include the amount, since that's the whole point of the app.

---

## 5. Accessibility & quality floor

- All text meets WCAG AA contrast against `--paper` and `--surface-card`.
- Visible focus states on all interactive elements (don't strip default focus rings without replacing them).
- Respect reduced-motion settings — disable the count-up animation and slide-in if the OS setting is on.
- Minimum tap target 44x44px throughout.
- Support dynamic type / font scaling — don't hardcode pixel heights that clip text at larger accessibility font sizes.

---

## 6. What to avoid

- No cream-background + terracotta-accent combo (overused AI-generated design default).
- No near-black + neon-green dashboard-hacker aesthetic — this is a calm consumer finance app, not a dev tool.
- No badges, streaks, or gamified "you saved $X!" congratulation modals — keep the tone factual and respectful of the user's autonomy.
- No stock financial-app clichés: piggy banks, dollar-sign icons, coins falling, confetti on payment.