# QA Acceptance

## Desktop viewport — 1280 × 720

The dashboard rendered successfully after restarting the development service. The left navigation is visible with Dashboard highlighted, the header and date filter card fit within the content column, the four metric cards form one row, and the first chart row begins below the fold without horizontal overflow. The selected December 2025 period displays non-zero sales values from the Overview snapshot. The status strip shows the CSO refresh time and the Overview latest data date.

## Mobile viewport — 375 × 812

The dashboard rendered in a single-column layout. The compact mobile header shows the Dashboard route and the navigation remains reachable through the sidebar trigger. The title, refresh button, status strip, quick date buttons, month/year selectors and date inputs stack vertically without visible horizontal overflow. Chart cards and metric cards continue below the first viewport in a readable vertical flow.

## Data and limitation checks

The Overview snapshot currently ends on 2025-12-31 and contains one outlet-level aggregate. The Top 5 Outlets chart therefore renders the available Mumsrelle MSOG row and explicitly states that the outlet dimension is unavailable for a true five-outlet ranking; no synthetic outlet rows are fabricated. CSO data is fetched from the configured Google Sheets tabs and cached for exactly five minutes. When the selected range is outside the snapshot or CSO data cannot be loaded, the dashboard presents a warning or empty state instead of silently presenting stale or fabricated values.

## Keyword Trends extension — 2026-08-18

Desktop verification at 1280px confirms the Keyword Trends navigation item, import CTA, offline-source status, seven filter controls, empty state, metric cards, Recharts containers, and ranking table are visible and aligned. Mobile verification at 375px confirms the header actions remain usable, the status card wraps into readable rows, and filters stack vertically without clipping. Empty charts intentionally remain empty until a real CSV or JSON export is uploaded. The template download contains headers only and no example metrics.
