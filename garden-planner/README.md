# Garden Planner

A small, dependency-free webapp for planning a non-rectangular garden: draw a polygonal
garden, tile it at a configurable size, paint tiles as grass or stone, and place labelled,
coloured rectangular, square and circular objects (furniture, pots, etc.) with hover
tooltips.

## Run it

No build step and no server required — open `index.html` directly in a browser:

```
open index.html            # macOS
xdg-open index.html        # Linux
start index.html           # Windows
```

Or serve the folder if you prefer:

```
python3 -m http.server 8000
# then browse to http://localhost:8000
```

All coordinates on the canvas are **centimetres** (1 cm = 4 px at 100% zoom).

## Usage

1. **Garden tool (G)** — click to add polygon corners; the live length (in cm) of the
   segment from the last corner to the cursor is shown while you move the mouse.
   Double-click, right-click, or click the first corner to close the shape. `Esc`
   cancels a redraw. "Redraw polygon" starts over; "Clear garden" removes it.
   Hold `Shift` while drawing to snap corners to the 10 cm grid (a blue crosshair
   marks the snapped point). A faint background grid (10 cm minor, 50 cm major) is
   drawn over the whole canvas.
2. **Tile size** — set the tile side length in cm and press *Apply*. The garden is
   tiled with squares of that size; a tile belongs to the garden when its centre lies
   inside the polygon. Changing the tile size clears painted tiles.
3. **Paint tool (P)** — choose Grass or Stone, then click/drag over tiles to paint them.
   *All grass* / *All stone* / *Clear tiles* act on the whole garden.
4. **Rect / Square / Circle tools (R / S / C)** — drag on the canvas to place an object.
   Squares keep equal sides; circles are placed centre-first with a draggable radius.
5. **Select tool (V)** — click an object to select it, drag to move it, drag the corner
   handle to resize (circle: the handle on its edge). `Delete` removes the selection.
6. **Object editor (side panel)** — set the label (drawn on the object), colour, and a
   free-text description. Hovering an object on the canvas shows its label and
   description in a tooltip.
7. **View** — mouse wheel zooms around the cursor; `+` / `−` / *Reset* buttons; hold
   `Space` and drag to pan.
8. **Data** — *Save*/*Load* persist to `localStorage` (autosave on change). *Export
   JSON* / *Import JSON* move plans between browsers or machines; *Export PNG* downloads
   an image of the current view. `Ctrl+Z` undoes the last action.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | UI shell (toolbar, side panel, canvas) |
| `styles.css` | Layout and styling |
| `garden-core.js` | Pure geometry/model logic (point-in-polygon, tiling, hit-testing); also loadable in Node |
| `app.js` | Canvas rendering, tools, editing, undo, persistence |
| `test/core.test.js` | Unit tests for `garden-core.js` (`node test/core.test.js`) |
| `test/smoke.test.js` | Headless DOM-stubbed end-to-end session (`node test/smoke.test.js`) |

## Data format (exported JSON)

```json
{
  "polygon": [{ "x": 0, "y": 0 }, ...],
  "tileSize": 30,
  "tiles": [["col,row", "grass|stone"], ...],
  "objects": [
    { "id": "obj-...", "type": "rect|square|circle", "x": 0, "y": 0,
      "w": 40, "h": 25, "r": 20, "color": "#c98f4e", "label": "Bench",
      "description": "free text" }
  ],
  "view": { "zoom": 1, "ox": 60, "oy": 60 }
}
```

`w`/`h` apply to rect and square, `r` to circle.
