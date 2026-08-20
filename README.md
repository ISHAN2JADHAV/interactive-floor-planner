# 📐 FloorPlan Studio Pro (interactive-floor-planner)

> An interactive 2D event layout, venue floor planning, CAD blueprint tracing, and guest seating management web application built with high-performance HTML5 Canvas and vanilla ES6+.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/Vanilla-ES6+-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5 Canvas](https://img.shields.io/badge/Rendering-HTML5%20Canvas%202D-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![No Dependencies](https://img.shields.io/badge/Dependencies-Zero%20Build%20Step-10B981)](#)

---

## ✨ Features

- **🚀 Interactive 2D Canvas Viewport Engine**:
  - Pan & Cursor-Centered Smooth Zooming (Mouse Wheel, `Space + Drag`, Middle Click).
  - Minimap Radar in the corner with a draggable viewport rectangle indicator.
  - Measurement Tape Measure Tool (`M`) measuring real-world distances in meters and feet.
  - Coordinate grid with 1-meter major guides and customizable snap-to-grid (`20px`).

- **🪑 Complete Element & Furniture Library**:
  - **Tables**: Round Banquet (6–12 seats), Rectangular / Trestle, Square, Imperial Oval, High-top Cocktails, Conference Classroom Rows, Executive U-Shape, Curved Serpentine.
  - **Staging & Fixtures**: Wooden Main Stage, Checkered Dance Floor, Cocktail Bars, DJ Booth, Photo Kiosk, VIP Sofas.
  - **Architectural**: Solid Wall Partitions, Structural Pillars, and Emergency Exits.
  - **Zones**: Customizable floor overlay zones.

- **🎯 Physics & Interactive Transformations**:
  - On-canvas top rotation handle gizmo (drag to rotate, hold `Shift` for 15° snapping).
  - Multi-select marquee box selection and multi-element drag.
  - Smart magnetic alignment guides (green/cyan lines) snapping to neighboring objects.
  - Real-time collision avoidance physics preventing overlapping.

- **👥 Attendee Seating & Dietary Roster**:
  - Click any chair on the canvas to open the instant Seat Assignment popup.
  - Hover chair tooltips show attendee name, dietary badge, and VIP status.
  - Color-coded seats by dietary requirements (*Vegan*, *Vegetarian*, *Halal*, *Kosher*, *Gluten-Free*, *Nut Allergy*) or VIP status.
  - **Smart Auto-Seat Optimizer**: Automatically clusters attendee parties/groups together into available table seats.
  - CSV Import and CSV Export.

- **🤝 Multi-Role Concurrency & Baton-Lock Model**:
  - Simulate multi-user collaboration between **Lead Planner**, **Venue Ops**, **Client / Host (Read-Only)**, and **Caterer**.
  - Edit lock transfer (baton passing) with live audit change stream.

- **📊 Export & Print Suite**:
  - **4K High-Res PNG**: Ultra-sharp floor plan image with watermark and title.
  - **Vector SVG**: Scalable vector floor plan export.
  - **Printable PDF Seating Chart**: Formatted run-of-show report with table-by-table seating manifest and dietary allergy breakdowns (`window.print()` ready).
  - **JSON Project File**: Full project backup and restore.

- **🎨 Pre-Built Event Templates**:
  - *Wedding Banquet Gala (120 Pax)*
  - *Corporate Awards Gala (240 Pax)*
  - *Tech Keynote & Workshop (80 Pax)*
  - *Cocktail Mixer & Lounge (80 Pax)*

---

## 🚀 Quick Start

No dependencies or build steps required! Simply clone and open `index.html` in any modern web browser:

```bash
git clone https://github.com/<your-username>/interactive-floor-planner.git
cd interactive-floor-planner
# Open index.html in your browser:
start index.html # On Windows
open index.html  # On macOS
xdg-open index.html # On Linux
```

---

## ⌨️ Keyboard & Mouse Shortcuts

| Key | Description |
| :--- | :--- |
| <kbd>V</kbd> | Selection & Move Tool |
| <kbd>H</kbd> / <kbd>Space+Drag</kbd> | Canvas Pan Tool |
| <kbd>M</kbd> | Measurement Ruler Tool |
| <kbd>Ctrl + Z</kbd> | Undo Last Action |
| <kbd>Ctrl + Y</kbd> | Redo |
| <kbd>Ctrl + D</kbd> | Duplicate Selection |
| <kbd>Del</kbd> / <kbd>Backspace</kbd> | Delete Selection |
| <kbd>R</kbd> | Rotate Selection +45° |
| <kbd>Shift + Drag</kbd> | Marquee Box Select / 15° Angle Snap |
| <kbd>Mouse Wheel</kbd> | Zoom in / out at cursor point |
| <kbd>Ctrl + 0</kbd> | Reset Zoom to 100% |
| <kbd>?</kbd> | Open Shortcuts Guide |

---

## 📁 Repository Structure

```text
interactive-floor-planner/
├── index.html        # Main application UI, canvas layout, modals, and toolbars
├── style.css         # Glassmorphic dark design system and printable PDF styles
├── app.js            # Math calculations, canvas 2D renderer, seating roster engine
├── README.md         # Documentation and project overview
└── .gitignore        # Git ignore rules
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
