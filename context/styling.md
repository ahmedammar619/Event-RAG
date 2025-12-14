# Styling Guide

## Overview

The application uses Tailwind CSS for styling with a custom component layer. The theme is a blue color scheme to match the Vewoz branding.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Tailwind CSS | Utility-first CSS framework |
| PostCSS | CSS processing |
| Custom CSS | Component classes in index.css |

## Color Scheme

### Primary Colors (Blue Theme)

| Usage | Tailwind Class | Hex |
|-------|---------------|-----|
| Primary | `blue-600` | #2563eb |
| Primary Hover | `blue-700` | #1d4ed8 |
| Primary Dark | `blue-900` | #1e3a8a |
| Background Gradient | `from-slate-800 to-blue-600` | - |

### Neutral Colors

| Usage | Tailwind Class |
|-------|---------------|
| Background | `bg-slate-50`, `bg-slate-100` |
| Text Primary | `text-slate-900` |
| Text Secondary | `text-slate-500`, `text-slate-600` |
| Borders | `border-slate-200`, `border-slate-300` |

### Status Colors

| Status | Background | Text |
|--------|------------|------|
| Success | `bg-green-100`, `bg-green-500` | `text-green-800` |
| Warning | `bg-amber-100`, `bg-amber-500` | `text-amber-800` |
| Error | `bg-red-100`, `bg-red-500` | `text-red-800` |

## Branding

### Platform: Vewoz

- Main platform name displayed in headers
- Logo: `/logo.png`
- Primary branding color: Blue gradient

### Event: MASCON 2025

- Event-specific branding within Vewoz platform
- Logo: `/mascon-logo.png`
- Displayed as secondary element below Vewoz branding

### Header Hierarchy

```
┌─────────────────────────────────────────┐
│  [Vewoz Logo] Vewoz        (Platform)   │
├─────────────────────────────────────────┤
│  [MASCON Logo] MASCON 2025  (Event)     │
│  Moderation System                       │
└─────────────────────────────────────────┘
```

## Custom Component Classes

Located in `apps/frontend/src/index.css`:

### Buttons

```css
.btn {
  @apply px-4 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer;
}

.btn-primary {
  @apply bg-blue-600 text-white hover:bg-blue-700;
}

.btn-secondary {
  @apply bg-slate-200 text-slate-700 hover:bg-slate-300;
}

.btn-danger {
  @apply bg-red-600 text-white hover:bg-red-700;
}

.btn-outline {
  @apply border-2 border-blue-600 text-blue-600 bg-transparent hover:bg-blue-50;
}

.btn-lg {
  @apply px-6 py-3 text-lg;
}

.btn-sm {
  @apply px-3 py-1.5 text-sm;
}
```

### Cards

```css
.card {
  @apply bg-white rounded-xl shadow-sm border border-slate-200;
}

.card-header {
  @apply px-6 py-4 border-b border-slate-200;
}

.card-body {
  @apply p-6;
}
```

### Forms

```css
.form-group {
  @apply mb-4;
}

.form-label {
  @apply block text-sm font-medium text-slate-700 mb-1;
}

.form-input {
  @apply w-full px-4 py-2.5 border border-slate-300 rounded-lg
         focus:ring-2 focus:ring-blue-500 focus:border-blue-500
         outline-none transition-all;
}

.form-error {
  @apply text-red-600 text-sm mt-1;
}
```

### Tables

```css
.table {
  @apply w-full text-left;
}

.table th {
  @apply px-4 py-3 bg-slate-50 font-semibold text-slate-600 text-sm uppercase tracking-wider;
}

.table td {
  @apply px-4 py-3 border-b border-slate-100;
}

.table tr:hover {
  @apply bg-slate-50;
}
```

### Stats

```css
.stat-card {
  @apply bg-white rounded-xl p-6 shadow-sm border border-slate-200;
}

.stat-value {
  @apply text-3xl font-bold text-slate-900;
}

.stat-label {
  @apply text-sm text-slate-500 mt-1;
}
```

### Badges

```css
.badge {
  @apply inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full;
}

.badge-success {
  @apply bg-green-100 text-green-800;
}

.badge-warning {
  @apply bg-amber-100 text-amber-800;
}

.badge-error {
  @apply bg-red-100 text-red-800;
}
```

### Toast Notifications

Toast notifications use inline styles for guaranteed visibility:

```javascript
const getToastStyle = (type) => {
  const baseStyle = {
    padding: '16px 24px',
    borderRadius: '8px',
    fontWeight: '500',
    minWidth: '250px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    color: 'white',
  }

  if (type === 'success') {
    return { ...baseStyle, backgroundColor: '#22c55e' }  // green-500
  } else if (type === 'error') {
    return { ...baseStyle, backgroundColor: '#ef4444' }  // red-500
  } else if (type === 'warning') {
    return { ...baseStyle, backgroundColor: '#f59e0b' }  // amber-500
  }
  return baseStyle
}
```

## Layout Components

### Admin Layout

Sidebar navigation with gradient background:

```jsx
<aside className="bg-gradient-to-b from-blue-700 to-blue-900 text-white">
  {/* Logo and nav items */}
</aside>
```

### Moderator Layout

Similar sidebar with bottom navigation for mobile:

```jsx
{/* Desktop Sidebar */}
<aside className="hidden lg:flex ... bg-gradient-to-b from-blue-700 to-blue-900">

{/* Mobile Bottom Navigation */}
<nav className="lg:hidden fixed bottom-0 ... bg-white border-t">
```

### Landing Page

Gradient background with frosted glass container:

```jsx
<div className="bg-gradient-to-br from-slate-800 to-blue-600">
  {/* Header with dark overlay */}
  <header className="bg-slate-900/50 backdrop-blur-sm border-b border-white/10">

  {/* Content container with frosted glass effect */}
  <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
```

## Responsive Design

### Breakpoints

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |

### Mobile-First Patterns

```jsx
// Show on desktop, hide on mobile
<div className="hidden lg:flex">

// Show on mobile, hide on desktop
<div className="lg:hidden">

// Different padding for mobile/desktop
<div className="p-4 lg:p-8">

// Column on mobile, row on desktop
<div className="flex flex-col sm:flex-row">
```

### Mobile Header Spacing

Fixed headers require top padding on content:

```jsx
// Admin Layout
<div className="mt-28 lg:mt-0">  {/* 112px on mobile, 0 on desktop */}

// Moderator Layout
<div className="pt-28 lg:pt-8">  {/* 112px on mobile, 32px on desktop */}
```

## Footer Component

Two variants for different backgrounds:

### Light Variant (for dark backgrounds like landing page)

```jsx
<footer className="w-full py-4 px-6">
  <div className="flex flex-col-reverse sm:flex-row items-center justify-between">
    {/* Copyright + Developer (left) */}
    <div className="flex items-center gap-2">
      <p className="text-white/60">&copy; 2025 Vewoz</p>
      <a className="text-white px-3 py-1 rounded-full bg-white/20 hover:bg-white/30">
        Developer
      </a>
    </div>
    {/* Portal link (right) */}
    <Link className="px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30">
      Admin Portal
    </Link>
  </div>
</footer>
```

### Dark Variant (for light backgrounds)

```jsx
<footer className="bg-slate-800 py-4 px-6">
  {/* Same structure with slate colors */}
</footer>
```

## Form Input Formatting

### US Phone Number

Auto-formats as user types: `(XXX) XXX-XXXX`

```javascript
const formatPhoneNumber = (value) => {
  const digits = value.replace(/\D/g, '')
  const limited = digits.slice(0, 10)

  if (limited.length === 0) return ''
  if (limited.length <= 3) return `(${limited}`
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`
}
```

## Danger Zone Styling

For destructive actions (like data reset):

```jsx
<div className="bg-red-50 rounded-xl border-2 border-red-200 p-6">
  <div className="p-3 bg-red-100 text-red-600 rounded-xl">
    {/* Warning icon */}
  </div>
  <h3 className="text-lg font-bold text-red-800">Danger Zone</h3>
  <p className="text-red-700">Warning text...</p>
  <button className="bg-red-600 text-white hover:bg-red-700">
    Destructive Action
  </button>
</div>
```

## Animation Classes

```css
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
```

## Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## Best Practices

1. **Use utility classes first** - Prefer Tailwind utilities over custom CSS
2. **Extract components** - Create custom classes for repeated patterns
3. **Mobile-first** - Start with mobile styles, add responsive modifiers
4. **Consistent spacing** - Use Tailwind's spacing scale (4, 6, 8, etc.)
5. **Color consistency** - Stick to the blue theme for primary actions
6. **Accessible contrast** - Ensure text is readable on all backgrounds
