# CSS Architecture & Style Guide

**Version**: 1.0
**Last Updated**: October 18, 2025
**Scope**: Frontend styling system, design tokens, and best practices

## Overview

The Hermes Trading Post uses a modern CSS architecture with:
- **Design system tokens** (colors, spacing, typography)
- **Utility-first classes** for rapid development
- **Layout system** for consistent page structure
- **Component-scoped styles** in Svelte components
- **No CSS framework dependencies** (custom implementation)

---

## CSS File Organization

### `/src/styles/index.css`
**Purpose**: Main import file that orchestrates all styles
**Contents**:
```css
@import './design-system-consolidated.css';
@import './layout-system.css';
@import './utility-system.css';
```
**Usage**: Import once in main app.css or +layout.svelte

### `/src/app.css`
**Purpose**: Application-level styles
**Contains**:
- App-wide typography
- Color adjustments per theme
- Global element resets
- Animation definitions

### `/src/styles/design-system-consolidated.css`
**Purpose**: Design tokens and constants
**Sections**:
1. **Color Palette**
   - Primary colors
   - Secondary colors
   - Semantic colors (success, error, warning, info)
   - Neutral scale

2. **Typography**
   - Font families
   - Font sizes (xs, sm, base, lg, xl, 2xl, etc.)
   - Font weights
   - Line heights

3. **Spacing**
   - Margin/padding scale (1px to 16px)
   - Gap sizes for flexbox/grid

4. **Shadows**
   - Elevation shadows (sm, md, lg, xl)
   - Semantic shadows (hover, active, focus)

5. **Borders**
   - Border widths
   - Border radii
   - Border colors

6. **Transitions**
   - Animation durations
   - Easing functions

### `/src/styles/layout-system.css`
**Purpose**: Layout components and grid system
**Contains**:
- `.layout-grid` for page structure
- `.container` for content width
- `.sidebar`, `.main`, `.header`, `.footer` classes
- Responsive breakpoints
- Flex and grid utilities

**Key Classes**:
```css
.layout-grid        /* Main page layout container */
.layout-sidebar     /* Sidebar section */
.layout-main        /* Main content section */
.layout-header      /* Header section */
.layout-footer      /* Footer section */
```

### `/src/styles/utility-system.css`
**Purpose**: Utility classes for rapid styling
**Contains**: Hundreds of single-purpose classes

**Categories**:
1. **Display & Visibility**
   - `.hidden`, `.visible`, `.block`, `.inline-block`, `.flex`, `.grid`
   - `.absolute`, `.relative`, `.fixed`, `.sticky`

2. **Spacing**
   - Padding: `.p-1`, `.p-2`, `.px-4`, `.py-2`
   - Margin: `.m-1`, `.m-2`, `.mx-auto`, `.my-3`
   - Gap: `.gap-2`, `.gap-4`

3. **Sizing**
   - Width: `.w-full`, `.w-1/2`, `.w-auto`
   - Height: `.h-full`, `.h-auto`, `.h-screen`
   - Min/Max: `.min-w-0`, `.max-w-xs`

4. **Typography**
   - Font size: `.text-xs`, `.text-base`, `.text-lg`, `.text-xl`
   - Font weight: `.font-light`, `.font-normal`, `.font-bold`
   - Text alignment: `.text-center`, `.text-right`, `.text-justify`
   - Text color: `.text-primary`, `.text-secondary`, `.text-error`

5. **Colors**
   - Background: `.bg-primary`, `.bg-surface`, `.bg-error`
   - Border: `.border-primary`, `.border-secondary`
   - Text: `.text-primary`, `.text-muted`

6. **Borders & Radius**
   - Border: `.border`, `.border-1`, `.border-2`
   - Radius: `.rounded`, `.rounded-sm`, `.rounded-lg`, `.rounded-full`

7. **Flexbox**
   - Direction: `.flex-row`, `.flex-col`, `.flex-wrap`
   - Alignment: `.items-center`, `.justify-center`, `.justify-between`
   - Growth: `.flex-1`, `.flex-grow`, `.flex-shrink-0`

8. **Grid**
   - Columns: `.grid-cols-1`, `.grid-cols-2`, `.grid-cols-auto`
   - Rows: `.grid-rows-1`, `.grid-rows-auto`
   - Gaps: `.gap-1`, `.gap-2`, `.gap-4`

9. **Effects**
   - Shadow: `.shadow`, `.shadow-md`, `.shadow-lg`
   - Opacity: `.opacity-50`, `.opacity-75`, `.opacity-100`
   - Transitions: `.transition`, `.transition-colors`, `.transition-transform`

---

## Design Tokens Reference

### Color Palette

```css
/* Primary Colors */
--color-primary: #3b82f6;           /* Blue */
--color-primary-dark: #1e40af;      /* Dark blue */
--color-primary-light: #93c5fd;     /* Light blue */

/* Secondary Colors */
--color-secondary: #6366f1;         /* Indigo */
--color-secondary-dark: #3730a3;    /* Dark indigo */

/* Semantic Colors */
--color-success: #10b981;           /* Green */
--color-error: #ef4444;             /* Red */
--color-warning: #f59e0b;           /* Amber */
--color-info: #06b6d4;              /* Cyan */

/* Neutral Scale */
--color-surface: #ffffff;           /* White */
--color-surface-dark: #f9fafb;      /* Light gray */
--color-border: #e5e7eb;            /* Gray */
--color-text: #111827;              /* Dark gray (text) */
--color-text-muted: #6b7280;        /* Light gray (muted) */
--color-background: #f3f4f6;        /* Very light gray */
```

### Typography Scale

```css
/* Font Sizes */
--font-size-xs: 0.75rem;            /* 12px */
--font-size-sm: 0.875rem;           /* 14px */
--font-size-base: 1rem;             /* 16px */
--font-size-lg: 1.125rem;           /* 18px */
--font-size-xl: 1.25rem;            /* 20px */
--font-size-2xl: 1.5rem;            /* 24px */

/* Font Weights */
--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* Line Heights */
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

### Spacing Scale

```css
/* All in 4px units */
--spacing-1: 0.25rem;   /* 4px */
--spacing-2: 0.5rem;    /* 8px */
--spacing-3: 0.75rem;   /* 12px */
--spacing-4: 1rem;      /* 16px */
--spacing-6: 1.5rem;    /* 24px */
--spacing-8: 2rem;      /* 32px */
--spacing-12: 3rem;     /* 48px */
--spacing-16: 4rem;     /* 64px */
```

---

## Using Styles in Components

### Utility-First Approach

**Preferred**: Use utility classes directly in HTML
```svelte
<div class="flex items-center justify-between p-4 bg-surface rounded-lg shadow">
  <span class="text-lg font-semibold text-text">Title</span>
  <button class="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark">
    Action
  </button>
</div>
```

### Component Scoped Styles

**When to use**: Complex, reusable styling logic
```svelte
<script>
  let variant = 'primary';
</script>

<button class="btn" class:btn-primary={variant === 'primary'} class:btn-secondary={variant === 'secondary'}>
  Click me
</button>

<style>
  .btn {
    padding: var(--spacing-2) var(--spacing-4);
    border-radius: var(--border-radius-base);
    font-weight: var(--font-weight-medium);
    transition: all var(--transition-duration-fast);
    cursor: pointer;
  }

  .btn-primary {
    background-color: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background-color: var(--color-primary-dark);
  }

  .btn-secondary {
    background-color: var(--color-secondary);
    color: white;
  }
</style>
```

### CSS-in-JS (Not Recommended)

Generally avoid inline style objects. Use utilities or scoped styles instead.

**Exception**: Dynamic values that cannot be CSS variables
```svelte
<div style="width: {dynamicWidth}px">
  Dynamic width
</div>
```

---

## Common Patterns

### Flex Container

```html
<!-- Horizontal center alignment -->
<div class="flex items-center justify-center p-4">
  Content
</div>

<!-- Vertical stack with spacing -->
<div class="flex flex-col gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- Space-between layout -->
<div class="flex items-center justify-between">
  <div>Left</div>
  <div>Right</div>
</div>
```

### Grid Layout

```html
<!-- 2-column grid with gap -->
<div class="grid grid-cols-2 gap-4">
  <div>Column 1</div>
  <div>Column 2</div>
</div>

<!-- Auto-flow grid -->
<div class="grid grid-cols-auto gap-2">
  <div>Auto 1</div>
  <div>Auto 2</div>
</div>
```

### Responsive Typography

```html
<!-- Responsive text size -->
<h1 class="text-xl lg:text-2xl font-bold">
  Responsive Heading
</h1>

<!-- Responsive layout -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div>Responsive grid</div>
</div>
```

### Card Component

```html
<div class="p-4 bg-surface rounded-lg shadow border border-border">
  <h2 class="text-lg font-semibold mb-2">Card Title</h2>
  <p class="text-muted text-sm">Card description</p>
</div>
```

### Button Variants

```html
<!-- Primary button -->
<button class="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition">
  Primary
</button>

<!-- Secondary button -->
<button class="px-4 py-2 bg-secondary text-white rounded hover:bg-secondary-dark transition">
  Secondary
</button>

<!-- Outline button -->
<button class="px-4 py-2 border border-primary text-primary rounded hover:bg-primary hover:text-white transition">
  Outline
</button>

<!-- Disabled button -->
<button disabled class="px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed opacity-50">
  Disabled
</button>
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile-first approach */
/* No prefix: 0px and up */
/* sm: 640px and up */
/* md: 768px and up */
/* lg: 1024px and up */
/* xl: 1280px and up */
```

**Usage**:
```html
<!-- Responsive classes -->
<div class="text-sm md:text-base lg:text-lg">
  Responsive text size
</div>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  Responsive grid
</div>
```

---

## Animation & Transitions

### Available Transitions

```css
--transition-duration-fast: 150ms;
--transition-duration-normal: 300ms;
--transition-duration-slow: 500ms;

--easing-linear: linear;
--easing-ease-in: ease-in;
--easing-ease-out: ease-out;
--easing-ease-in-out: ease-in-out;
```

**Usage**:
```html
<!-- Smooth color transition on hover -->
<div class="bg-primary hover:bg-primary-dark transition">
  Hover me
</div>

<!-- Transform animation -->
<div class="scale-100 hover:scale-105 transition-transform">
  Scale on hover
</div>
```

---

## Best Practices

### ✅ Do

1. **Use utility classes for simple styling**
   ```html
   <div class="flex items-center gap-2 p-4">Good</div>
   ```

2. **Use CSS variables for theming**
   ```css
   color: var(--color-text);
   font-size: var(--font-size-base);
   ```

3. **Scope complex styles to components**
   ```svelte
   <style>
     .my-complex-component { ... }
   </style>
   ```

4. **Use design tokens consistently**
   ```css
   padding: var(--spacing-4);
   border-radius: var(--border-radius-lg);
   ```

5. **Follow mobile-first approach**
   ```html
   <div class="text-base md:text-lg lg:text-xl">
   ```

### ❌ Don't

1. **Don't use inline styles for everything**
   ```svelte
   <!-- Avoid -->
   <div style="padding: 16px; color: blue;">Bad</div>

   <!-- Good -->
   <div class="p-4 text-primary">Good</div>
   ```

2. **Don't hardcode colors**
   ```css
   /* Avoid */
   color: #3b82f6;

   /* Good */
   color: var(--color-primary);
   ```

3. **Don't repeat spacing values**
   ```css
   /* Avoid */
   padding: 16px;
   margin: 16px;
   gap: 16px;

   /* Good */
   padding: var(--spacing-4);
   margin: var(--spacing-4);
   gap: var(--spacing-4);
   ```

4. **Don't create component-specific utilities**
   - Use scoped component styles instead
   - Keeps utilities focused and reusable

---

## Adding New Styles

### Process for New Design Tokens

1. **Discuss with team**: Ensure consistency with existing system
2. **Add to design-system-consolidated.css**: Define the token
3. **Update this guide**: Document the new token
4. **Use consistently**: Apply everywhere applicable

### Process for New Utility Classes

1. **Check existing utilities**: Don't duplicate
2. **Add to utility-system.css**: Define the utility
3. **Test in components**: Verify it works as expected
4. **Document here**: Add to this guide

### Process for New Components

1. **Prefer utilities**: Start with utility classes
2. **Use scoped styles if needed**: For complex logic
3. **Reference tokens**: Don't hardcode values
4. **Document pattern**: Add example to this guide

---

## Troubleshooting

### Styles not applying?

1. Check CSS file import order (index.css imported?)
2. Verify class name spelling
3. Check CSS specificity (component styles override utilities)
4. Inspect with browser dev tools

### Responsive not working?

1. Verify breakpoint prefix used correctly (md:, lg:, etc.)
2. Check mobile-first approach (smallest screen first)
3. Use `@media` queries in scoped styles if needed

### Color looks wrong?

1. Use CSS variables, not hardcoded colors
2. Check color against design token definitions
3. Verify in browser dev tools
4. Test light/dark mode if applicable

---

## Future Improvements

1. **Dark mode support**: Add dark theme CSS variables
2. **CSS custom properties documentation**: Auto-generate reference
3. **Figma integration**: Keep styles synced with design system
4. **Performance audit**: Identify unused utilities
5. **Component library**: Catalog all styled components

---

## Resources

- **Design System**: See `design-system-consolidated.css`
- **Layout System**: See `layout-system.css`
- **Utilities**: See `utility-system.css`
- **Component Styles**: Check individual `.svelte` file `<style>` blocks

---

**Maintained by**: Development Team
**Last Reviewed**: October 18, 2025
**Next Review**: When design system changes
