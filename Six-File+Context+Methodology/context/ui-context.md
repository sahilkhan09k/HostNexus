# UI Context

## Theme

HostNexus uses a **premium modern B2B marketplace aesthetic** inspired by high-end SaaS platforms and hospitality technology products.

The visual language should communicate:

* Professional trust
* Premium hospitality
* Modern technology
* AI-powered intelligence
* Marketplace activity
* Operational clarity

The application supports **dark and light modes**, with the dark theme being the primary presentation/demo experience.

The design should avoid looking like a generic dashboard. It should feel like a **premium hospitality infrastructure platform**.

### Core visual principles

* Clean, spacious layouts
* Strong visual hierarchy
* Premium cards and surfaces
* Subtle gradients
* Glassmorphism only for emphasis, not every component
* Soft shadows and layered depth
* Clear data visualization
* Smooth micro-interactions
* Large, visually strong marketplace imagery
* AI interactions should feel intelligent and dynamic
* Functional interfaces should remain clean and operational

Do not use excessive gradients, rounded pills, shadows, or animations. The interface should remain professional and purposeful.

---

## Colors

All components must use semantic design tokens. Do not introduce arbitrary hardcoded color values inside individual components.

### Core color tokens

| Role                 | CSS Variable             | Dark Value                 |
| -------------------- | ------------------------ | -------------------------- |
| Page background      | `--bg-base`              | `#09090B`                  |
| Secondary background | `--bg-subtle`            | `#111113`                  |
| Surface              | `--bg-surface`           | `#18181B`                  |
| Elevated surface     | `--bg-elevated`          | `#202024`                  |
| Primary text         | `--text-primary`         | `#FAFAFA`                  |
| Secondary text       | `--text-secondary`       | `#A1A1AA`                  |
| Muted text           | `--text-muted`           | `#71717A`                  |
| Primary accent       | `--accent-primary`       | `#7C3AED`                  |
| Primary accent hover | `--accent-primary-hover` | `#8B5CF6`                  |
| Secondary accent     | `--accent-secondary`     | `#06B6D4`                  |
| Accent glow          | `--accent-glow`          | `rgba(124, 58, 237, 0.18)` |
| Border               | `--border-default`       | `#27272A`                  |
| Border subtle        | `--border-subtle`        | `#1F1F22`                  |
| Error                | `--state-error`          | `#EF4444`                  |
| Warning              | `--state-warning`        | `#F59E0B`                  |
| Success              | `--state-success`        | `#22C55E`                  |
| Info                 | `--state-info`           | `#3B82F6`                  |

### Brand color usage

**Purple (`--accent-primary`)**

Use for:

* Primary actions
* Active navigation
* Important AI interactions
* Selected filters
* Primary CTAs
* Focus states

**Cyan (`--accent-secondary`)**

Use sparingly for:

* AI indicators
* Data and intelligence visualization
* Secondary highlights
* Matching scores
* Interactive map intelligence

**Green (`--state-success`)**

Use for:

* Available resources
* Confirmed bookings
* Successful payments
* Positive performance indicators

**Amber (`--state-warning`)**

Use for:

* Pending requests
* Negotiations
* Attention-required states

**Red (`--state-error`)**

Use for:

* Errors
* Rejected bookings
* Conflicts
* Destructive actions

### Important rule

Do not use accent colors decoratively everywhere.

Accent colors must communicate **interaction, intelligence, status, or importance**.

---

## Typography

### Font stack

| Role                | Font       | Variable         |
| ------------------- | ---------- | ---------------- |
| UI text             | Inter      | `--font-sans`    |
| Display/headings    | Outfit     | `--font-display` |
| Code/technical data | Geist Mono | `--font-mono`    |

### Typography usage

**Outfit**

Use for:

* Hero headlines
* Large page headings
* High-impact dashboard numbers
* Landing page marketing sections

**Inter**

Use for:

* Navigation
* Forms
* Buttons
* Tables
* Cards
* Marketplace details
* General application UI

**Geist Mono**

Use only for:

* Technical values
* IDs
* AI tool execution states
* Structured metadata
* Debug/developer information

### Hierarchy

```text
Hero Heading       → Large, bold, display font
Page Heading       → Prominent, display font
Section Heading    → Strong UI heading
Card Heading       → Medium weight
Body               → Regular Inter
Metadata           → Smaller muted text
Labels             → Small, medium weight
```

Avoid using too many font sizes. Maintain a consistent scale.

---

## Border Radius

HostNexus uses moderately rounded surfaces. The design should feel premium and modern, but not excessively playful.

| Context                | Class         |
| ---------------------- | ------------- |
| Inline / small UI      | `rounded-md`  |
| Inputs / buttons       | `rounded-lg`  |
| Cards / panels         | `rounded-xl`  |
| Resource cards         | `rounded-xl`  |
| Modals / overlays      | `rounded-2xl` |
| Hero visual containers | `rounded-2xl` |

Avoid excessive `rounded-full`.

Use pill shapes primarily for:

* Tags
* Status indicators
* Filter chips
* Small category badges

---

## Component Library

HostNexus uses:

* **Next.js**
* **Tailwind CSS**
* **shadcn/ui**
* **Radix primitives through shadcn/ui**
* **Lucide React**

Base reusable components live in:

```text
apps/web/components/ui/
```

Feature-specific components live in:

```text
apps/web/components/
├── marketplace/
├── dashboard/
├── ai/
├── booking/
└── shared/
```

### Component rules

* Prefer existing shadcn/ui components before creating custom primitives.
* Use the shadcn CLI when adding supported components.
* Do not duplicate existing UI primitives.
* Feature components should compose primitives rather than recreate them.
* Keep business logic outside presentational UI components where possible.
* Components should support loading, empty, and error states where applicable.

---

## Layout Patterns

### Landing page

```text
Navbar
    ↓
Hero
    ↓
Search / Discovery
    ↓
Categories
    ↓
Marketplace Benefits
    ↓
AI Concierge Promotion
    ↓
Platform Statistics
    ↓
Call To Action
    ↓
Footer
```

The landing page should feel visually rich and premium.

Use:

* Large headline
* Strong CTA
* Marketplace imagery
* Resource search interaction
* Platform statistics
* Subtle motion

---

### Marketplace discovery

Primary desktop pattern:

```text
┌──────────────────────────────────────────────┐
│ Navbar                                       │
├──────────────────────────────────────────────┤
│ Search + Filter Bar                          │
├───────────────────────┬──────────────────────┤
│                       │                      │
│ Resource Results      │ Interactive Map      │
│                       │                      │
│ Resource Cards        │ Resource Markers     │
│                       │                      │
└───────────────────────┴──────────────────────┘
```

Desktop should support a split discovery experience:

* Resource results on the left
* Interactive map on the right
* Synchronization between cards and map markers

On mobile:

* Stack content vertically
* Allow users to toggle between **List** and **Map**

---

### Dashboard

Desktop pattern:

```text
┌──────────────┬───────────────────────────────┐
│              │ Top Bar                       │
│              ├───────────────────────────────┤
│ Sidebar      │ Page Header                   │
│              ├───────────────────────────────┤
│ Navigation   │ Metrics                       │
│              ├───────────────────────────────┤
│              │ Charts / Tables / Content     │
│              │                               │
└──────────────┴───────────────────────────────┘
```

The sidebar should contain:

* Dashboard
* Resources
* Bookings
* Requirements
* Calendar
* Messages
* Analytics
* AI Concierge
* Settings

The dashboard should prioritize **at-a-glance operational information**.

---

### AI Concierge

The AI experience is one of the primary HostNexus differentiators.

The interface should support:

```text
User Message
     ↓
AI Reasoning / Processing State
     ↓
Tool Execution
     ↓
Rich Result Cards
     ↓
User Action
```

The chat interface may appear as:

* Floating assistant
* Expandable chat panel
* Full-screen AI workspace

AI responses should support rich UI blocks such as:

* Resource cards
* Comparison tables
* Availability summaries
* Price estimates
* Matching scores
* Booking action cards

Tool execution states should be visually distinct but not expose unnecessary internal reasoning.

---

### Booking and RFQ workflow

Use a timeline-oriented interface.

```text
Booking Request
      ↓
Provider Review
      ↓
Quotation
      ↓
Counter Offer
      ↓
Acceptance
      ↓
Payment
      ↓
Confirmation
```

The current booking status must always be obvious.

Use semantic status colors consistently:

* Pending → Warning
* Quoted → Info
* Negotiating → Primary accent
* Confirmed → Success
* Completed → Success
* Cancelled → Error

---

### Calendar

Use a clean operational calendar.

Show:

* Confirmed bookings
* Pending requests
* Blocked dates
* Resource availability

Do not overload the calendar with excessive visual styling.

---

### Modals and overlays

Use:

* Centered dialog
* Subtle backdrop blur
* Strong surface separation
* Clear primary and secondary actions
* Escape/close behavior

For destructive actions:

* Require clear confirmation
* Use error styling only for destructive context

---

## Cards

Cards are a primary HostNexus UI pattern.

### Standard card structure

```text
Header
    ↓
Primary Content
    ↓
Supporting Metadata
    ↓
Actions
```

Resource cards should prioritize:

1. Image
2. Resource name
3. Category
4. Capacity/specification
5. Location
6. Price
7. Availability/status
8. Provider trust information

Do not put excessive information into every marketplace card.

---

## Forms

Forms should be:

* Step-based for complex workflows
* Clearly grouped
* Explicitly labelled
* Easy to scan

For the resource listing wizard:

```text
Step 1 → Resource category
Step 2 → Basic information
Step 3 → Specifications
Step 4 → Pricing
Step 5 → Availability
Step 6 → Images
Step 7 → Review and publish
```

Use progressive disclosure for category-specific specifications.

Avoid showing irrelevant fields.

---

## Tables and Data

Use tables for:

* Booking management
* Quotations
* Analytics details
* Transaction history
* Resource inventory

Tables should support:

* Clear column hierarchy
* Status badges
* Loading states
* Empty states
* Responsive fallback where required

Do not force wide desktop tables onto mobile screens.

---

## Charts and Analytics

Analytics should emphasize clarity over decoration.

Use charts for:

* Revenue trends
* Resource utilization
* Category demand
* Booking volume
* Business performance

Charts must have:

* Clear labels
* Meaningful tooltips
* Accessible contrast
* Consistent semantic colors

Avoid excessive chart types.

---

## Loading States

Every asynchronous interface should provide an appropriate loading state.

Use:

* Skeleton loaders for cards and page content
* Spinner/progress indicators for short actions
* Button loading states for mutations
* Streaming indicators for AI responses

Do not use full-page blocking loaders unless absolutely necessary.

---

## Empty States

Empty states should:

1. Explain what is missing.
2. Provide a useful next action.
3. Remain visually simple.

Examples:

```text
No resources yet
→ List your first resource

No booking requests
→ Browse the marketplace

No messages
→ Start a conversation

No AI results
→ Try a more specific requirement
```

---

## Error States

Errors must:

* Explain the problem in plain language.
* Preserve user input where possible.
* Provide a retry action when appropriate.

Avoid raw technical error messages in the user interface.

---

## Animations

Use **Framer Motion** for meaningful animations.

Recommended:

* Page transitions
* Card hover elevation
* Modal entrance/exit
* AI streaming transitions
* Status changes
* Expand/collapse interactions

Animation should generally feel:

```text
Fast
Subtle
Purposeful
```

Avoid:

* Excessive bouncing
* Long animations
* Constant decorative movement
* Animation that delays interaction

Respect reduced-motion preferences.

---

## Icons

Use **Lucide React**.

Use stroke-based icons only.

Recommended sizes:

| Context            | Size                   |
| ------------------ | ---------------------- |
| Inline text        | `h-3.5 w-3.5`          |
| Standard UI        | `h-4 w-4`              |
| Buttons            | `h-4 w-4` or `h-5 w-5` |
| Navigation         | `h-5 w-5`              |
| Feature highlights | `h-6 w-6`              |
| Empty states       | `h-8 w-8`              |

Do not mix multiple icon libraries.

---

## Images

Resource imagery is extremely important for marketplace trust.

Images should:

* Use consistent aspect ratios
* Have appropriate object-fit behavior
* Use optimized Next.js image handling
* Include loading states
* Include fallback states

Resource cards should generally use a visually consistent landscape ratio.

---

## Responsive Design

HostNexus must work across:

* Desktop
* Tablet
* Mobile

### Desktop

Prioritize:

* Split layouts
* Sidebars
* Data density
* Maps
* Dashboard analytics

### Tablet

Prioritize:

* Collapsible navigation
* Reduced multi-column layouts

### Mobile

Prioritize:

* Single-column content
* Bottom sheets where appropriate
* Large touch targets
* Simplified filters
* Toggleable map/list views

Do not simply shrink desktop layouts.

---

## Accessibility

All UI must support:

* Keyboard navigation
* Visible focus states
* Sufficient color contrast
* Accessible labels
* Semantic HTML
* Screen-reader-friendly interactive elements

Do not communicate critical state through color alone.

---

## UI Decision Hierarchy

When making a UI decision, prioritize:

1. User clarity
2. Core task completion
3. Consistency with existing components
4. Responsive behavior
5. Accessibility
6. Visual polish
7. Decorative effects

---

## Final Rule

Before creating a new UI pattern:

1. Check whether a similar component already exists.
2. Reuse or extend the existing component when appropriate.
3. Follow the design tokens and layout patterns defined in this document.
4. Avoid introducing a new visual language for a single page.
5. Keep the interface consistent with the premium, modern, AI-powered B2B hospitality marketplace identity of HostNexus.
