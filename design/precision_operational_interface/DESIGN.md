---
name: ALIGN Industrial
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#006d38'
  on-secondary: '#ffffff'
  secondary-container: '#74f9a0'
  on-secondary-container: '#00723a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c1b1b'
  on-tertiary-container: '#858383'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#77fca3'
  secondary-fixed-dim: '#59df89'
  on-secondary-fixed: '#00210d'
  on-secondary-fixed-variant: '#005228'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474646'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
  status-success: '#4ade80'
  status-warning: '#fbbf24'
  status-error: '#fca5a5'
  border-light: '#f3f4f6'
  brand-gold: '#f5a623'
  brand-red: '#d0021b'
  surface-dark: '#1c1c1c'
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 72px
    fontWeight: '900'
    lineHeight: '1.0'
    letterSpacing: -0.05em
  headline-lg:
    fontFamily: Inter
    fontSize: 60px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '900'
    lineHeight: '1.1'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Geist
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.15em
  data-tabular:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 100%
  gutter: 24px
  margin-page: 48px
  component-gap: 20px
  section-padding: 80px
---

## Brand & Style
The brand identity is rooted in industrial precision and high-stakes inventory management. It targets logistics professionals, warehouse administrators, and financial auditors who require high-density data and absolute clarity. 

The design style is a hybrid of **Minimalism** and **High-Contrast Boldness**. It utilizes a "Split personality" layout: a dark, immersive brand-focused area for atmospheric context, and a stark, high-efficiency light area for transactional tasks. The visual language conveys reliability and authority through thick, purposeful typography and a vibrant accent palette used sparingly for status communication.

## Colors
The system employs a high-contrast palette. 
- **Core Neutrality:** The primary interface relies on pure black (`#000000`) and white (`#ffffff`) for maximum legibility.
- **Industrial Brand Palette:** A "tricolor" strip of Green (`#00a859`), Gold (`#f5a623`), and Red (`#d0021b`) is used as a signature brand element.
- **Functional Semantics:** Status colors are derived from high-vibrancy pastels (Success: `#4ade80`, Warning: `#fbbf24`, Error: `#fca5a5`) set against deep, tinted backgrounds for "glowing" indicators in dark modes.
- **Interface Surfaces:** Backgrounds alternate between a clean light gray (`#f4f5f6`) for global canvases and a deep obsidian (`#121212`) for focused brand panels.

## Typography
The typography system is built for extreme legibility and hierarchical clarity.
- **Headlines:** Use **Inter** with "Black" weights (900) for high-impact display moments. Tight tracking and line height are essential for a professional, "published" look.
- **Labels:** Use **Geist** for technical data and micro-copy. All-caps styling with high letter spacing (15%+) is the standard for system indicators and category headers.
- **Data:** Numerical values should use **Geist** for its monospaced-like clarity in tabular contexts, ensuring that numbers align vertically across rows.

## Layout & Spacing
The layout uses a **Split-Screen Fluid Grid**. 
- **Desktop:** A 50/50 split divides the viewport into a "Context/Brand" panel and a "Task/Input" panel. 
- **Mobile:** The layout reflows into a single column, prioritizing the "Task/Input" panel, with the "Context" panel minimized to a header.
- **Rhythm:** An 8px base grid is used. Component spacing is generous within sections (20px gap between form elements) but tight within data clusters (4-8px).
- **Safe Areas:** Large internal padding (80px on large screens) ensures the content feels premium and focused rather than cluttered.

## Elevation & Depth
The system uses **Tonal Layers** and **Subtle Ambient Shadows** rather than traditional elevation.
- **Brand Cards:** Use deep surfaces (`#1c1c1c`) with high-contrast borders (`#374151`) to create a sense of inset depth.
- **Main Interaction Cards:** Use a soft shadow (`0 8px 30px rgba(0,0,0,0.04)`) to subtly lift the white input area from the light gray background.
- **Overlays:** The "Floating Administrative Menu" uses a high-depth shadow (`shadow-2xl`) and a backdrop blur (blur-sm) to indicate a global context shift.
- **Interactive Elements:** Buttons utilize a slight scale transform (0.98) on click rather than elevation changes to simulate tactile feedback.

## Shapes
The shape language is "Functional Geometric."
- **Standard Radius:** Base components (inputs, buttons) use a 0.5rem (8px) radius to maintain a modern but structured feel.
- **Brand Accents:** Badges and specialized containers use a smaller 4px radius to feel more technical and rigid.
- **Container Radius:** Large cards and surface areas use 1rem (16px) or 1.5rem (24px) for a softer, more inviting enclosure.

## Components
- **Buttons:** Primary buttons are solid black with white text and icons. They must be 48px high for touch/click efficiency. 
- **Input Fields:** Styled with a "Light Field" aesthetic: white background, 1px gray-200 border, and a 48px height. Focus states must use a 1px solid black border with a subtle inner ring.
- **Status Cards:** These comprise a background tint, a matching border, and a high-vibrancy label. They are used for displaying critical system metrics (e.g., SAP REFS).
- **Iconography:** Utilize **Material Symbols Outlined** at a consistent weight (400) and optical size (20px/24px).
- **Navigation:** The "Floating Administrative Menu" is hidden by default and triggered via a specific brand interaction (double-click), acting as a "power user" layer.
- **Brand Badge:** Small, boxed indicators featuring a 1:1 circular status dot to represent system health or environment status.