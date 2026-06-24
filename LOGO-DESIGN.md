# QC Checklist App Logo & Branding

## Logo Design Overview

The QC Checklist app logo combines three core elements:

### Design Elements

1. **Clipboard** — Represents inspection, documentation, and quality checks
2. **Checkmarks** — Indicate verified items, quality assurance, and completion
3. **Construction Level** — Symbolizes precision, building industry, and safety

### Color Palette

| Element | Color | Usage |
|---------|-------|-------|
| Primary | `#004E89` (Blue) | Clipboard, circles, main structure |
| Success | `#059669` (Green) | Checkmarks (verified items) |
| Alert | `#EA580C` (Orange) | Construction level, alerts |
| Background | White | Clean, professional appearance |

### Logo Files

```
assets/
├── logo-qc-checklist.svg          # Master SVG (scalable)
├── icon.png                       # 192x192 (app store)
├── adaptive-icon.png              # Android adaptive icon
└── splash.png                     # 1024x1024 (splash screen)
```

### Design Guidelines

**Minimum Size:** 48x48 pixels (readable at smallest sizes)
**Safe Zone:** Keep logo elements within center 80% for app icon usage
**Padding:** Maintain 10% padding around logo

### Typography

- **App Name:** QC Checklist
- **Tagline:** Quality Control at Every Step
- **Font:** Clean sans-serif (Arial, Helvetica, or system fonts)

### Logo Variations

1. **Full Logo** — Clipboard + checkmarks + "QC" text (primary)
2. **Icon Only** — Clipboard with checkmarks (app icon)
3. **Monochrome** — Single color for printing/simple backgrounds

### Implementation

The app currently uses:
- `assets/icon.png` — App icon (192x192)
- `assets/adaptive-icon.png` — Android adaptive icon
- `assets/splash.png` — Splash screen (1024x1024)

Update these files with the new logo design while maintaining the 1:1 aspect ratio for app icons.

### Brand Voice

**Mission:** Empower construction teams to maintain quality and safety standards in the field.
**Values:**
- Accessibility — Easy to use for all team members
- Reliability — Offline-first, always available
- Safety — Built-in alerts for high-severity issues
- Collaboration — Team communication and shared accountability

### Accessibility Notes

- Logo has sufficient contrast ratio (WCAG AA compliant)
- Works in both light and dark modes
- Remains readable when scaled down to 24x24 pixels
- No text required for icon recognition

---

*Logo design created for QC Checklist v1.0*
*Colors align with app theme defined in tailwind.config.js*
