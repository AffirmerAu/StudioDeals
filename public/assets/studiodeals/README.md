# Studiodeals icon package

Mark 2A — white person silhouette in a white ring, amber squircle. Family rules match
StudioCash and StudioTime: squircle app icon, gradient fill, white ring, one glyph, and a
Poppins 700 wordmark with the suffix in the accent colour.

## Colour
- Icon gradient: #fbbf24 (top-left) → #d97706 (bottom-right)
- Flat single-colour (small sizes / favicons): #f59e0b
- Wordmark: "Studio" #f1f5f9, "Deals" #fbbf24 on dark / #d97706 on light
- App background used for previews: #08090b

## Files
| File | Use |
|---|---|
| icon-rounded.svg | Master. Rounded squircle, gradient. Web app icon, PWA, docs. |
| icon-square.svg | Master for iOS. Square, no rounding — iOS applies its own mask. |
| icon-maskable.svg | Android maskable source (glyph inset to the 80% safe zone). |
| icon-flat-small.svg | Flat #f59e0b, heavier strokes. Source for 16/32px favicons. |
| icon-mono-white.svg | Transparent, white glyph only. For monochrome/stencil placements. |
| lockup-dark.svg | Horizontal icon + wordmark for dark backgrounds. Requires Poppins. |
| favicon.svg | Same as icon-rounded.svg, for `rel="icon" type="image/svg+xml"`. |
| favicon-16/32/48.png | Classic favicons (flat variant). |
| apple-touch-icon-120/152/167/180.png | iOS home screen. Square, opaque, no rounding. |
| icon-192/512.png, icon-maskable-512.png | PWA / Android. |
| site.webmanifest | Drop-in manifest. |
| head-snippet.html | The `<head>` tags to paste. |

## Notes
- No .ico is included. Every browser in current support accepts PNG and SVG favicons; add one
  only if you need IE-era compatibility.
- lockup-dark.svg uses live text so it stays editable. Convert the text to outlines before
  handing it to anyone who won't have Poppins installed.
- Minimum clear space around the icon: 25% of its width. Don't recolour the glyph, don't put the
  gradient behind the wordmark, and don't use the icon at under 16px.
