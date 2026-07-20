# DESIGN.md: PoultryPilot

## Brand & Visual Identity

PoultryPilot's visual identity will be clean, modern, and data-rich, reflecting efficiency and precision in farm management. The aesthetic will combine professional clarity with an approachable, natural feel, using earthy and fresh tones to convey reliability, growth, and health. The design aims to make complex data digestible and actionable for the farm owner.

## User Experience Goals

1.  **Efficiency in Data Entry:** Users can complete daily data logging for all flocks within 2 minutes, reducing manual effort and increasing compliance.
2.  **Clarity of Insights:** Key performance indicators (KPIs) on the dashboard (e.g., FCR, mortality rate, egg production) are understandable at a glance, allowing users to identify trends or issues within 5 seconds.
3.  **Actionable Alerts:** Users successfully respond to 90% of critical system alerts (e.g., low inventory, production drop, high mortality) within 24 hours of notification, leading to timely interventions.

## Color Palette

The color palette is designed to be modern, clean, and evoke a sense of nature and data clarity.

```css
:root {
  /* Primary */
  --color-primary-green: #4CAF50; /* Farm Green */
  --color-primary-green-dark: #388E3C;

  /* Secondary */
  --color-secondary-blue: #2196F3; /* Sky Blue */
  --color-secondary-blue-dark: #1976D2;

  /* Accent */
  --color-accent-orange: #FF9800; /* Sunrise Orange */
  --color-accent-red: #F44336;   /* Alert Red */
  --color-accent-yellow: #FFC107; /* Warning Yellow */

  /* Neutrals */
  --color-neutral-lightest: #F8F9FA; /* Background Light */
  --color-neutral-light: #E9ECEF;   /* Border/Divider */
  --color-neutral-medium: #ADB5BD;  /* Placeholder Text */
  --color-neutral-dark: #495057;    /* Body Text */
  --color-neutral-darkest: #212529;  /* Heading Text */
}
```

## Typography

A combination of a modern sans-serif for headings and a highly readable sans-serif for body text ensures clarity and a professional appearance.

*   **Headings:** Montserrat (Google Fonts: [https://fonts.google.com/specimen/Montserrat](https://fonts.google.com/specimen/Montserrat))
*   **Body Text:** Lato (Google Fonts: [https://fonts.google.com/specimen/Lato](https://fonts.google.com/specimen/Lato))

**Font Size Scale (Base 16px):**

| Scale | Size (px) | Usage |
|:---|:---|:---|
| xs | 12 | Small text, captions |
| sm | 14 | Secondary text, labels |
| base | 16 | Body text, form inputs |
| lg | 18 | Subheadings, important labels |
| xl | 24 | Section titles |
| 2xl | 32 | Main page titles |
| 3xl | 48 | Dashboard primary metrics |

**Font Weights:**

*   Light (300)
*   Regular (400)
*   Semi-bold (600)
*   Bold (700)

## UI Components & Spacing

A consistent design system will be built upon a 4px grid unit for precise alignment and spacing.

*   **Grid Unit:** 4px
*   **Border-Radius Scale:**
    *   `border-radius-sm`: 2px (subtle rounding for inputs)
    *   `border-radius-md`: 4px (standard for cards, buttons)
    *   `border-radius-lg`: 8px (more pronounced for larger containers)
    *   `border-radius-full`: 9999px (for pill-shaped elements)
*   **Standard Spacing Values (multiples of 4px):**
    *   `space-xs`: 4px
    *   `space-sm`: 8px
    *   `space-md`: 12px
    *   `space-lg`: 16px
    *   `space-xl`: 24px
    *   `space-2xl`: 32px
    *   `space-3xl`: 48px
    *   `space-4xl`: 64px

## Screen Priorities

The following screens are prioritized for development and user experience, ordered by importance for each role:

### Admin Role

1.  **Dashboard:** Central overview of all critical farm metrics, alerts, and quick actions.
2.  **Flock Management:** Creation, editing, and detailed viewing of Layer and Broiler flocks.
3.  **System Configuration:** Setting up alert thresholds, inventory items, and reorder levels.
4.  **User Management:** Inviting, deactivating, and managing farm worker accounts.
5.  **Sales Orders:** Creating and managing sales, generating invoices.
6.  **Reporting:** Access to Egg Production, Broiler Growth, and Cost & Revenue reports.
7.  **Inventory Management:** Detailed view and manual adjustments of inventory.

### Farm Worker Role

1.  **Daily Data Entry:** Streamlined forms for logging feed, water, mortality, and egg production.
2.  **Dashboard:** View of relevant daily metrics and active alerts.
3.  **Health & Treatment Log:** Recording health events and treatments for flocks or individual birds.
4.  **Inventory Overview:** View current stock levels for assigned items.

## Interaction & Motion

Interactions will be subtle, functional, and contribute to a smooth, responsive user experience without being distracting.

*   **Hover States:** All interactive elements (buttons, links, cards, table rows) will have distinct, subtle hover states (e.g., slight background color change, shadow lift, text color shift).
*   **Transitions:** Smooth `ease-in-out` transitions for hover states, state changes (e.g., button loading), and modal openings/closings.
*   **Animation Durations:** Short durations, typically `150ms` to `300ms`, to ensure responsiveness. Longer animations will be reserved for complex data visualizations if necessary, but kept minimal.
*   **Form Feedback:** Clear visual feedback for form validation (e.g., red borders for errors, green for success) and submission (e.g., loading spinners on buttons).

## Accessibility

Accessibility is a core consideration to ensure the system is usable by all farmers.

*   **Contrast Ratios:** All text and interactive elements will meet WCAG 2.1 AA contrast ratio standards (minimum 4.5:1 for normal text, 3:1 for large text and graphical objects).
*   **Keyboard Navigation:** The entire application will be fully navigable using only a keyboard.
    *   Clear focus indicators (e.g., `outline` styles) will be visible on all interactive elements.
    *   Logical tab order will be maintained across all screens and components.
    *   Standard keyboard shortcuts (e.g., Enter for buttons, Space for checkboxes) will be supported.
*   **Semantic HTML:** Proper semantic HTML5 elements will be used to provide a clear structure for assistive technologies.
*   **ARIA Attributes:** Appropriate ARIA roles, states, and properties will be used where native HTML semantics are insufficient (e.g., for custom components, live regions).
*   **Responsive Design:** The UI will be responsive and adapt gracefully to various screen sizes, ensuring usability on mobile devices for field data entry.