# HostNexus — DESIGN.md
## Persistent Design System Blueprint

---

## 1. Brand Context & Visual Archetype

- **Product**: AI-powered B2B marketplace for hospitality resource sharing
- **Industry lane**: B2B Hospitality Marketplace (Pune / Mumbai, India)
- **Brand voice**: Executive, Trustworthy, Rapid, Futuristic yet grounded
- **Visual DNA**: Deep onyx canvas + emerald accent + glass surfaces — like a premium fintech dashboard meets a luxury hospitality app
- **Design variance**: 8/10 — unique, non-generic, not vibe-coded
- **Motion intensity**: 7/10 — snappy, purposeful, no cartoon springs
- **Visual density**: 7.5/10 — data-rich but breathable

---

## 2. Color Palette Tokens

| Token | Hex | Usage |
|---|---|---|
| `canvas` | `#090D16` | Page background |
| `surface-1` | `#0F172A` | Section backgrounds |
| `surface-2` | `#1E293B` | Card backgrounds |
| `surface-3` | `#293548` | Input backgrounds, active states |
| `primary` | `#10B981` | CTAs, active badges, focus rings |
| `primary-dark` | `#059669` | Hover state on primary |
| `primary-glow` | `rgba(16,185,129,0.25)` | CTA box-shadow |
| `accent` | `#0EA5E9` | Secondary highlights (Sky) |
| `amber` | `#F59E0B` | Warning, pending states |
| `foreground` | `#F1F5F9` | Primary text |
| `muted` | `#64748B` | Disabled text, placeholders |
| `subtle` | `#94A3B8` | Secondary text, captions |
| `border` | `rgba(255,255,255,0.08)` | Default card borders |
| `border-hover` | `rgba(255,255,255,0.16)` | Hovered card borders |

### Glass Surface Presets
```css
/* Level 1 — Standard card */
bg: rgba(255,255,255,0.04)
border: 1px solid rgba(255,255,255,0.08)
backdrop-filter: blur(12px)

/* Level 2 — Active/Hovered card */
bg: rgba(255,255,255,0.06)
border: 1px solid rgba(255,255,255,0.14)

/* Level 3 — Modal/Popover */
bg: rgba(9,13,22,0.95)
border: 1px solid rgba(255,255,255,0.12)
backdrop-filter: blur(24px)
```

---

## 3. Typography Scale & Font Families

| Role | Font | Weight | Size | Tracking | Line-height |
|---|---|---|---|---|---|
| Hero display | Outfit | 800 | `5xl`→`8xl` | `-0.03em` | `1.05` |
| Section title | Outfit | 700 | `3xl`→`4xl` | `tight` | `1.15` |
| Card title | Plus Jakarta Sans | 600 | `lg`→`xl` | `normal` | `1.3` |
| Body | Plus Jakarta Sans | 400 | `sm`→`base` | `normal` | `relaxed` |
| Caption / Badge | Plus Jakarta Sans | 600 | `xs` | `widest` | `1` |
| Metrics / Data | Geist Mono | 700 | `sm`→`xl` | `normal` | `1` |

---

## 4. Elevation, Shadows & Glass Surfaces

```css
/* Ambient glow — hero backdrop */
box-shadow: 0 0 180px rgba(16,185,129,0.18);

/* Card shadow — standard */
box-shadow: 0 4px 20px -2px rgba(0,0,0,0.4), 0 2px 6px -1px rgba(0,0,0,0.2);

/* CTA button glow */
box-shadow: 0 0 24px rgba(16,185,129,0.30);

/* CTA button glow — hover */
box-shadow: 0 0 36px rgba(16,185,129,0.45);

/* Elevated modal */
box-shadow: 0 20px 60px -10px rgba(0,0,0,0.7), 0 4px 20px rgba(0,0,0,0.4);
```

---

## 5. Component Blueprint

### Buttons
```tsx
// Primary CTA
className="rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white
  shadow-[0_0_24px_rgba(16,185,129,0.30)]
  hover:bg-emerald-400 hover:shadow-[0_0_36px_rgba(16,185,129,0.45)]
  transition-all duration-200 active:scale-[0.98]"

// Secondary / Ghost
className="rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold
  text-slate-200 backdrop-blur-sm
  hover:border-white/20 hover:bg-white/8
  transition-all duration-200"
```

### Cards (glass)
```tsx
className="relative overflow-hidden rounded-2xl
  border border-white/8 bg-white/4 backdrop-blur-md
  transition-all duration-300
  hover:border-white/14 hover:bg-white/6
  shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)]"
```

### Badges / Pills
```tsx
className="inline-flex items-center gap-2 rounded-full
  border border-emerald-500/25 bg-emerald-500/10
  px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400"
```

### Input fields
```tsx
className="w-full rounded-xl border border-white/10 bg-white/5
  px-4 py-3 text-sm text-slate-100
  placeholder:text-slate-500
  focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40
  transition-all duration-200"
```

---

## 6. Motion Principles

- **Micro-interactions**: `150ms ease-out [0.22, 1, 0.36, 1]`
- **Component entrances**: `250–300ms [0.32, 0.72, 0, 1]`
- **Page / section reveals**: `translateY(16px)→0`, `opacity 0→1`, `350ms`
- **Exits**: `150ms ease-in` (faster than entrances)
- **Stat chip hover**: `spring { stiffness: 300, damping: 20 }` → `y: -4px, scale: 1.02`
- **Magnet button**: `spring { stiffness: 250, damping: 18, mass: 0.1 }`
- **Never**: `width`, `height`, `margin`, `padding` animations
- **Always**: Respect `prefers-reduced-motion`

---

## 7. Anti-Patterns & Quality Gate Checklist

### Before shipping any component:
- [ ] Background is tinted onyx/slate, never white or plain gray
- [ ] All text passes WCAG AA (4.5:1 contrast minimum)
- [ ] Interactive elements have `:hover`, `:active`, `:focus-visible`, `:disabled` states
- [ ] No raw emoji used as UI icons — Lucide SVGs only
- [ ] No thick `border-2 solid` — use `border border-white/8` glass borders
- [ ] Numbers/metrics use `font-mono tabular-nums`
- [ ] CTA has visible glow/shadow, not just a color change
- [ ] Skeleton loaders match the exact loaded layout shape
- [ ] Responsive: tested at 375px, 768px, 1024px, 1440px
- [ ] `cn()` utility used for all className merging
- [ ] No `hover:scale-110` — max `hover:scale-[1.015]` on cards
