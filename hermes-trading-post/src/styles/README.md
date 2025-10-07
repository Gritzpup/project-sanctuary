# Hermes Trading Post - CSS Style Guide

This document outlines the CSS architecture, naming conventions, and best practices for the Hermes Trading Post application.

## 🏗️ Architecture Overview

### File Structure
```
src/styles/
├── design-system-consolidated.css  # Core design system & variables
├── layout-system.css              # Grid, flexbox, layout utilities
├── utility-system.css             # Utility classes
├── index.css                      # Main entry point
└── README.md                      # This documentation
```

### Import Order
1. CSS custom properties and design tokens
2. Reset and base styles
3. Layout system
4. Component styles
5. Utility classes

## 🎨 Design System

### CSS Custom Properties
All design tokens are defined in `design-system-consolidated.css` using CSS custom properties:

```css
:root {
  /* Colors */
  --color-primary: #3b82f6;
  --color-text-primary: #ffffff;
  --color-surface: #1a1a1a;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  
  /* Typography */
  --font-size-sm: 0.875rem;
  --font-weight-medium: 500;
  
  /* Borders */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}
```

## 📏 Naming Conventions

### BEM Methodology
We use a modified BEM (Block Element Modifier) approach:

#### Block
Top-level component or standalone entity:
```css
.trading-panel { }
.chart-container { }
.backup-card { }
```

#### Element
Parts of a block, indicated by double underscore:
```css
.trading-panel__header { }
.trading-panel__content { }
.trading-panel__footer { }
```

#### Modifier
Variations or states, indicated by double dash:
```css
.trading-panel--collapsed { }
.trading-panel--loading { }
.backup-card--selected { }
```

### Utility Classes
Utility classes follow a functional naming pattern:

#### Layout
```css
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.grid { display: grid; }
.hidden { display: none; }
```

#### Spacing
```css
.p-4 { padding: 1rem; }
.m-2 { margin: 0.5rem; }
.mt-4 { margin-top: 1rem; }
.gap-2 { gap: 0.5rem; }
```

#### Sizing
```css
.w-full { width: 100%; }
.h-screen { height: 100vh; }
.max-w-md { max-width: 28rem; }
```

### State Classes
State-based classes use descriptive names:
```css
.is-active { }
.is-disabled { }
.is-loading { }
.is-selected { }
.has-error { }
```

## 🎯 Component Patterns

### Component Structure
Each component should follow this CSS structure:

```css
/* 1. Block/Root element */
.component-name {
  /* Layout properties first */
  display: flex;
  position: relative;
  
  /* Box model */
  padding: var(--spacing-md);
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  
  /* Visual properties */
  background: var(--color-surface);
  color: var(--color-text-primary);
  
  /* Typography */
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  
  /* Animations/transitions */
  transition: all 0.2s ease;
}

/* 2. Elements */
.component-name__element {
  /* ... */
}

/* 3. Modifiers */
.component-name--modifier {
  /* ... */
}

/* 4. States */
.component-name:hover {
  /* ... */
}

.component-name:focus {
  /* ... */
}

.component-name.is-active {
  /* ... */
}
```

### Button Components
```css
.btn {
  /* Base button styles */
  padding: 0.75rem 1.5rem;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.btn--secondary {
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.btn--sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Form Components
```css
.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-primary);
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-input.has-error {
  border-color: var(--color-error);
}
```

## ♿ Accessibility Classes

### Screen Reader Only
```css
.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}
```

### Focus Management
```css
.focus-outline {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.focus-ring {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
}
```

## 📱 Responsive Design

### Breakpoints
```css
/* Mobile first approach */
.component {
  /* Mobile styles by default */
}

@media (min-width: 640px) {
  /* sm: Small tablets */
  .component {
    /* ... */
  }
}

@media (min-width: 768px) {
  /* md: Tablets */
  .component {
    /* ... */
  }
}

@media (min-width: 1024px) {
  /* lg: Small desktops */
  .component {
    /* ... */
  }
}

@media (min-width: 1280px) {
  /* xl: Large desktops */
  .component {
    /* ... */
  }
}
```

### Container Queries (when supported)
```css
@container (min-width: 768px) {
  .component {
    /* Styles based on container size */
  }
}
```

## 🎭 Animation Guidelines

### Transitions
- Use consistent timing: `0.2s ease` for most interactions
- Use `0.3s ease-out` for entering animations
- Use `0.2s ease-in` for exiting animations

```css
.component {
  transition: all 0.2s ease;
}

.modal-enter {
  animation: modalEnter 0.3s ease-out;
}

.modal-exit {
  animation: modalExit 0.2s ease-in;
}
```

### Reduced Motion
Always respect user preferences:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 🚨 Anti-Patterns to Avoid

### ❌ Don't
```css
/* Overly specific selectors */
.page .container .component .element .nested { }

/* !important overuse */
.component {
  color: red !important;
  margin: 0 !important;
}

/* Magic numbers */
.component {
  margin-top: 13px;
  padding-left: 7px;
}

/* Inconsistent naming */
.tradingPanel { } /* camelCase */
.trading_panel { } /* snake_case */
.Trading-Panel { } /* PascalCase */
```

### ✅ Do
```css
/* Clear, specific selectors */
.trading-panel__header { }

/* Use CSS custom properties */
.component {
  margin-top: var(--spacing-md);
  padding-left: var(--spacing-sm);
}

/* Consistent naming */
.trading-panel { }
.trading-panel__header { }
.trading-panel--collapsed { }
```

## 🔧 Development Workflow

### 1. Before Adding New Styles
- Check if utility classes can solve the need
- Look for existing patterns to extend
- Consider if new CSS custom properties are needed

### 2. Component Development
- Start with semantic HTML structure
- Apply base component styles
- Add responsive behavior
- Test with different content lengths
- Verify accessibility

### 3. Code Review Checklist
- [ ] Uses CSS custom properties for values
- [ ] Follows BEM naming conventions
- [ ] Includes focus states for interactive elements
- [ ] Responsive design considered
- [ ] Accessibility attributes added
- [ ] No magic numbers or hardcoded values
- [ ] Consistent with existing patterns

## 📊 Performance Considerations

### Critical CSS
Core styles are loaded first:
- CSS custom properties
- Base typography and colors
- Critical component styles

### CSS Optimization
- Use `contain: layout style` for isolated components
- Minimize repaints with `transform` and `opacity` for animations
- Use `will-change` sparingly and remove after animations

### Bundle Size
- Utility classes help reduce duplication
- Component styles are scoped to avoid conflicts
- Unused styles can be identified and removed

## 🔗 Related Documentation
- [Accessibility Guidelines](../utils/AccessibilityHelpers.ts)
- [Design Tokens](./design-system-consolidated.css)
- [Component Examples](../components/README.md)

---

## 📝 Contributing

When adding new styles:
1. Follow the established naming conventions
2. Use existing CSS custom properties
3. Add accessibility considerations
4. Update this documentation if adding new patterns
5. Test across different screen sizes and browsers

For questions or suggestions, please refer to the project's main documentation or create an issue in the repository.