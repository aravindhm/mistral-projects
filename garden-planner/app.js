(function () {
  'use strict';

  const PX_PER_CM = 4;
  const TILE_COLORS = { grass: '#8fd06a', stone: '#c9c9c9' };
  const GARDEN_FILL = '#eaf6e6';
  const GARDEN_STROKE = '#3f7038';
  const MIN_SIZE = 2;
  const PALETTE = ['#c98f4e', '#7aa7d9', '#d97a7a', '#8fbf6a', '#b58ad9', '#d9c26a'];
  const STORAGE_KEY = 'garden-planner-v1';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const tooltip = document.getElementById('tooltip');
  const canvasWrap = document.getElementById('canvasWrap');

  const ui = {
    tileSize: document.getElementById('tileSize'),
    gardenStatus: document.getElementById('gardenStatus'),
    objectList: document.getElementById('objectList'),
    objectEditor: document.getElementById('objectEditor'),
    objHint: document.getElementById('objHint'),
    objLabel: document.getElementById('objLabel'),
    objColor: document.getElementById('objColor'),
    objDesc: document.getElementById('objDesc'),
    geomRow: document.getElementById('geomRow'),
    zoomLabel: document.getElementById('zoomLabel'),
  };

  const state = {
    mode: 'select',
    polygon: [],
    drawingGarden: false,
    prevPolygon: null,
    gardenCursor: null,
    tileSize: 30,
    tiles: new Map(),
    objects: [],
    selectedId: null,
    hoverId: null,
    view: { zoom: 1, ox: 60, oy: 60 },
    paint: 'grass',
    drag: null,
    spaceDown: false,
    undoStack: [],
  };

  let dpr = 1;
  let cssW = 0;
  let cssH = 0;
  let tileCache = { key: '', cells: [] };
  let saveTimer = null;

  function $(id) { return document.getElementById(id); }

  function viewScale() { return state.view.zoom * PX_PER_CM; }

  function screenOf(world) {
    const s = viewScale();
    return { x: state.view.ox + world.x * s, y: state.view.oy + world.y * s };
  }

  function eventWorld(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const s = viewScale();
    return { x: (sx - state.view.ox) / s, y: (sy - state.view.oy) / s, sx: sx, sy: sy };
  }

  function applyTransform() {
    const s = viewScale();
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * state.view.ox, dpr * state.view.oy);
  }

  function resize() {
    const rect = canvasWrap.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    cssW = Math.max(50, rect.width);
    cssH = Math.max(50, rect.height);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    draw();
  }

  function gardenDefined() {
    return state.polygon.length >= 3 && !state.drawingGarden;
  }

  function getCells() {
    const key = state.tileSize + '|' + state.polygon.map(function (p) { return p.x.toFixed(3) + ',' + p.y.toFixed(3); }).join(';');
    if (tileCache.key !== key) {
      tileCache = { key: key, cells: gardenDefined() ? GardenCore.cellsForPolygon(state.polygon, state.tileSize) : [] };
    }
    return tileCache.cells;
  }

  function selectedObject() {
    return state.objects.find(function (o) { return o.id === state.selectedId; }) || null;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#eef1ee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    applyTransform();
    drawBackgroundGrid();
    drawGarden();
    drawObjects();
    drawPreview();
  }

  function drawBackgroundGrid() {
    const s = viewScale();
    const left = -state.view.ox / s;
    const top = -state.view.oy / s;
    const right = (cssW - state.view.ox) / s;
    const bottom = (cssH - state.view.oy) / s;
    const minor = 10;
    const major = 50;
    const hairline = 1 / (dpr * s);
    ctx.lineWidth = hairline;
    ctx.beginPath();
    for (let x = Math.ceil(left / minor) * minor; x <= right; x += minor) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = Math.ceil(top / minor) * minor; y <= bottom; y += minor) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.stroke();
    ctx.beginPath();
    for (let x = Math.ceil(left / major) * major; x <= right; x += major) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = Math.ceil(top / major) * major; y <= bottom; y += major) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.11)';
    ctx.stroke();
  }

  function pathPolygon(close) {
    ctx.beginPath();
    state.polygon.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    if (close) ctx.closePath();
  }

  function drawGarden() {
    if (state.polygon.length === 0) return;
    if (gardenDefined()) {
      pathPolygon(true);
      ctx.fillStyle = GARDEN_FILL;
      ctx.fill();
      const ts = state.tileSize;
      for (const cell of getCells()) {
        const kind = state.tiles.get(GardenCore.cellKey(cell.col, cell.row)) || 'grass';
        ctx.fillStyle = TILE_COLORS[kind] || TILE_COLORS.grass;
        ctx.fillRect(cell.col * ts, cell.row * ts, ts, ts);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 0.15;
      for (const cell of getCells()) {
        ctx.strokeRect(cell.col * ts, cell.row * ts, ts, ts);
      }
      pathPolygon(true);
      ctx.strokeStyle = GARDEN_STROKE;
      ctx.lineWidth = 0.6;
      ctx.setLineDash([]);
      ctx.stroke();
    }
    if (state.drawingGarden) {
      pathPolygon(false);
      ctx.strokeStyle = GARDEN_STROKE;
      ctx.lineWidth = 0.4;
      ctx.setLineDash([1.2, 0.8]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (state.gardenCursor && state.polygon.length > 0) {
        const last = state.polygon[state.polygon.length - 1];
        const cur = state.gardenCursor;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.strokeStyle = 'rgba(63,112,56,0.5)';
        ctx.lineWidth = 0.25;
        ctx.setLineDash([0.8, 0.8]);
        ctx.stroke();
        ctx.setLineDash([]);
        const len = Math.hypot(cur.x - last.x, cur.y - last.y);
        const label = GardenCore.formatLength(len);
        const mx = (last.x + cur.x) / 2;
        const my = (last.y + cur.y) / 2;
        ctx.font = '2.6px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeText(label, mx, my - 0.8);
        ctx.fillStyle = '#2f5c2a';
        ctx.fillText(label, mx, my - 0.8);
      }
      ctx.fillStyle = '#2f5c2a';
      for (const p of state.polygon) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function objectPath(o) {
    ctx.beginPath();
    if (o.type === 'circle') {
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    } else {
      ctx.rect(o.x, o.y, o.w, o.h);
    }
  }

  function drawObjects() {
    for (const o of state.objects) {
      objectPath(o);
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = o.color || '#c98f4e';
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([]);
      if (o.id === state.selectedId) {
        ctx.strokeStyle = '#1a73e8';
        ctx.lineWidth = 0.7;
        ctx.setLineDash([1.4, 1]);
      } else if (o.id === state.hoverId) {
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 0.8;
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (o.label) {
        const cx = o.type === 'circle' ? o.x : o.x + o.w / 2;
        const cy = o.type === 'circle' ? o.y : o.y + o.h / 2;
        ctx.font = '3px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.strokeText(o.label, cx, cy);
        ctx.fillStyle = 'rgba(20,20,20,0.85)';
        ctx.fillText(o.label, cx, cy);
      }
    }
    const sel = selectedObject();
    if (sel && state.mode === 'select') drawHandles(sel);
  }

  function handlePos(o) {
    if (o.type === 'circle') return { x: o.x + o.r, y: o.y };
    return { x: o.x + o.w, y: o.y + o.h };
  }

  function drawHandles(o) {
    const hp = handlePos(o);
    const s = viewScale();
    const r = Math.max(0.9, 8 / s);
    ctx.beginPath();
    ctx.rect(hp.x - r, hp.y - r, r * 2, r * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#1a73e8';
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }

  function handleHit(e) {
    const sel = selectedObject();
    if (!sel || state.mode !== 'select') return false;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const hp = screenOf(handlePos(sel));
    return Math.hypot(hp.x - sx, hp.y - sy) <= 9;
  }

  function drawPreview() {
    const d = state.drag;
    if (!d || d.kind !== 'place') return;
    let o;
    if (d.type === 'circle') {
      const r = Math.hypot(d.cur.x - d.x1, d.cur.y - d.y1);
      if (r < MIN_SIZE) return;
      o = { type: 'circle', x: d.x1, y: d.y1, r: r };
    } else {
      const rr = GardenCore.rectFromDrag(d.x1, d.y1, d.cur.x, d.cur.y, { square: d.type === 'square' });
      if (rr.w < MIN_SIZE || rr.h < MIN_SIZE) return;
      o = Object.assign({ type: d.type }, rr);
    }
    objectPath(o);
    ctx.fillStyle = 'rgba(26,115,232,0.18)';
    ctx.fill();
    ctx.strokeStyle = '#1a73e8';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([1.4, 1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function gardenClick(w) {
    if (!state.drawingGarden) {
      pushUndo();
      state.prevPolygon = state.polygon.map(function (p) { return { x: p.x, y: p.y }; });
      state.polygon = [{ x: w.x, y: w.y }];
      state.drawingGarden = true;
      state.tiles.clear();
      refreshPanel();
      return;
    }
    if (state.polygon.length > 0) {
      const last = state.polygon[state.polygon.length - 1];
      if (Math.hypot(w.x - last.x, w.y - last.y) < 2 / viewScale()) return;
    }
    const first = state.polygon[0];
    const snap = 10 / viewScale();
    if (state.polygon.length >= 3 && Math.hypot(w.x - first.x, w.y - first.y) <= snap) {
      finishGarden();
      return;
    }
    if (state.polygon.length < 200) {
      state.polygon.push({ x: w.x, y: w.y });
    }
  }

  function finishGarden() {
    if (state.polygon.length >= 3) {
      state.drawingGarden = false;
      saveSoon();
      refreshPanel();
    }
  }

  function cancelGarden() {
    state.polygon = state.prevPolygon || [];
    state.drawingGarden = false;
    refreshPanel();
  }

  function startRedraw() {
    if (state.drawingGarden) return;
    pushUndo();
    state.prevPolygon = state.polygon.map(function (p) { return { x: p.x, y: p.y }; });
    state.polygon = [];
    state.drawingGarden = true;
    state.tiles.clear();
    refreshPanel();
    draw();
  }

  function paintAt(w) {
    if (!gardenDefined()) return;
    if (!GardenCore.pointInPolygon(w, state.polygon)) return;
    const cell = GardenCore.cellAt(w, state.tileSize);
    state.tiles.set(GardenCore.cellKey(cell.col, cell.row), state.paint);
  }

  function dragMove(w) {
    const d = state.drag;
    if (d.kind === 'pan') {
      state.view.ox = d.ox + (w.sx - d.sx);
      state.view.oy = d.oy + (w.sy - d.sy);
      return;
    }
    if (d.kind === 'paint') { paintAt(w); return; }
    if (d.kind === 'place') { d.cur = w; return; }
    const o = state.objects.find(function (obj) { return obj.id === d.id; });
    if (!o) return;
    if (d.kind === 'move') {
      o.x = w.x - d.dx;
      o.y = w.y - d.dy;
    } else if (d.kind === 'resize') {
      if (o.type === 'circle') {
        o.r = Math.max(MIN_SIZE, Math.hypot(w.x - o.x, w.y - o.y));
      } else if (o.type === 'square') {
        const side = Math.max(MIN_SIZE, w.x - o.x, w.y - o.y);
        o.w = side;
        o.h = side;
      } else {
        o.w = Math.max(MIN_SIZE, w.x - o.x);
        o.h = Math.max(MIN_SIZE, w.y - o.y);
      }
    }
  }

  function commitPlace(d, w) {
    let props;
    if (d.type === 'circle') {
      const r = Math.hypot(w.x - d.x1, w.y - d.y1);
      if (r < MIN_SIZE) return;
      props = { x: d.x1, y: d.y1, r: r };
    } else {
      const rr = GardenCore.rectFromDrag(d.x1, d.y1, w.x, w.y, { square: d.type === 'square' });
      if (rr.w < MIN_SIZE || rr.h < MIN_SIZE) return;
      props = rr;
    }
    const obj = GardenCore.makeObject(d.type, Object.assign({
      color: PALETTE[state.objects.length % PALETTE.length],
    }, props));
    state.objects.push(obj);
    select(obj.id);
    saveSoon();
  }

  function updateHover(w, e) {
    const hit = state.mode === 'garden' ? null : GardenCore.hitTest(state.objects, w);
    state.hoverId = hit ? hit.id : null;
    if (hit && (hit.label || hit.description)) {
      tooltip.innerHTML = '';
      const title = document.createElement('strong');
      title.textContent = hit.label || '(unlabelled)';
      tooltip.appendChild(title);
      if (hit.description) {
        const p = document.createElement('p');
        p.textContent = hit.description;
        tooltip.appendChild(p);
      }
      const x = Math.min(e.clientX + 16, window.innerWidth - 270);
      const y = Math.min(e.clientY + 16, window.innerHeight - 130);
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
      tooltip.hidden = false;
    } else {
      tooltip.hidden = true;
    }
  }

  function updateCursor(e) {
    if (state.spaceDown) { canvas.style.cursor = 'grab'; return; }
    if (state.drag) {
      canvas.style.cursor = state.drag.kind === 'pan' ? 'grabbing' : 'crosshair';
      return;
    }
    switch (state.mode) {
      case 'garden':
      case 'paint':
      case 'rect':
      case 'square':
      case 'circle':
        canvas.style.cursor = 'crosshair';
        break;
      default:
        if (handleHit(e)) canvas.style.cursor = 'nwse-resize';
        else if (state.hoverId) canvas.style.cursor = 'move';
        else canvas.style.cursor = 'default';
    }
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button === 2) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    tooltip.hidden = true;
    const w = eventWorld(e);
    if (state.spaceDown) {
      state.drag = { kind: 'pan', sx: w.sx, sy: w.sy, ox: state.view.ox, oy: state.view.oy };
      return;
    }
    if (state.mode === 'garden') { gardenClick(w); draw(); return; }
    if (state.mode === 'paint') {
      if (!gardenDefined()) return;
      pushUndo();
      state.drag = { kind: 'paint' };
      paintAt(w);
      draw();
      return;
    }
    if (state.mode === 'rect' || state.mode === 'square' || state.mode === 'circle') {
      pushUndo();
      state.drag = { kind: 'place', type: state.mode, x1: w.x, y1: w.y, cur: w };
      return;
    }
    if (handleHit(e)) {
      pushUndo();
      state.drag = { kind: 'resize', id: state.selectedId };
      return;
    }
    const hit = GardenCore.hitTest(state.objects, w);
    if (hit) {
      select(hit.id);
      pushUndo();
      state.drag = { kind: 'move', id: hit.id, dx: w.x - hit.x, dy: w.y - hit.y };
    } else {
      select(null);
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    const w = eventWorld(e);
    state.gardenCursor = w;
    if (state.drag) {
      dragMove(w);
    } else {
      updateHover(w, e);
    }
    updateCursor(e);
    draw();
  });

  canvas.addEventListener('pointerup', function (e) {
    if (!state.drag) return;
    const w = eventWorld(e);
    const d = state.drag;
    state.drag = null;
    if (d.kind === 'place') commitPlace(d, w);
    if (d.kind === 'paint' || d.kind === 'move' || d.kind === 'resize') saveSoon();
    refreshPanel();
    draw();
  });

  canvas.addEventListener('pointerleave', function () {
    state.hoverId = null;
    tooltip.hidden = true;
    state.gardenCursor = null;
    draw();
  });

  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    if (state.drawingGarden) {
      if (state.polygon.length >= 3) finishGarden();
      else cancelGarden();
      draw();
    }
  });

  canvas.addEventListener('dblclick', function () {
    if (state.mode === 'garden' && state.drawingGarden && state.polygon.length >= 3) {
      finishGarden();
      draw();
    }
  });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.key === ' ') {
      state.spaceDown = true;
      e.preventDefault();
      canvas.style.cursor = 'grab';
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
      e.preventDefault();
      deleteSelected();
      return;
    }
    if (e.key === 'Escape') {
      if (state.drawingGarden) {
        if (state.polygon.length >= 3) finishGarden();
        else cancelGarden();
        draw();
      } else {
        setMode('select');
      }
      return;
    }
    const modes = { v: 'select', g: 'garden', p: 'paint', r: 'rect', s: 'square', c: 'circle' };
    const m = modes[e.key.toLowerCase()];
    if (m) setMode(m);
  });

  window.addEventListener('keyup', function (e) {
    if (e.key === ' ') {
      state.spaceDown = false;
      draw();
    }
  });

  function snapshot() {
    return {
      polygon: state.polygon,
      tileSize: state.tileSize,
      tiles: Array.from(state.tiles.entries()),
      objects: state.objects,
      view: state.view,
    };
  }

  function pushUndo() {
    state.undoStack.push(JSON.stringify({
      polygon: state.polygon,
      drawingGarden: state.drawingGarden,
      tileSize: state.tileSize,
      tiles: Array.from(state.tiles.entries()),
      objects: state.objects,
    }));
    if (state.undoStack.length > 100) state.undoStack.shift();
  }

  function undo() {
    const s = state.undoStack.pop();
    if (!s) return;
    const data = JSON.parse(s);
    state.polygon = data.polygon;
    state.drawingGarden = !!data.drawingGarden;
    state.tileSize = data.tileSize;
    state.tiles = new Map(data.tiles);
    state.objects = data.objects;
    state.selectedId = null;
    ui.tileSize.value = String(state.tileSize);
    refreshPanel();
    saveSoon();
    draw();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
    } catch (err) {}
  }

  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
  }

  function loadFrom(data) {
    if (!data || typeof data !== 'object') return false;
    if (Array.isArray(data.polygon)) {
      state.polygon = data.polygon.filter(function (p) { return p && isFinite(p.x) && isFinite(p.y); });
    }
    state.drawingGarden = false;
    if (isFinite(data.tileSize) && data.tileSize > 0) {
      state.tileSize = data.tileSize;
      ui.tileSize.value = String(state.tileSize);
    }
    if (Array.isArray(data.tiles)) {
      state.tiles = new Map(data.tiles.filter(function (t) { return Array.isArray(t) && t.length === 2; }));
    }
    if (Array.isArray(data.objects)) {
      state.objects = data.objects.filter(function (o) { return o && typeof o === 'object' && typeof o.type === 'string'; });
    }
    if (data.view && isFinite(data.view.zoom)) {
      state.view = { zoom: GardenCore.clamp(data.view.zoom, 0.2, 8), ox: +data.view.ox || 0, oy: +data.view.oy || 0 };
    }
    state.selectedId = null;
    state.undoStack = [];
    refreshPanel();
    draw();
    return true;
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) loadFrom(JSON.parse(raw));
    } catch (err) {}
  }

  function setMode(m) {
    state.mode = m;
    document.querySelectorAll('#modeGroup .mode').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.mode === m);
    });
    document.getElementById('paintGroup').style.display = m === 'paint' ? '' : 'none';
    draw();
  }

  function select(id) {
    state.selectedId = id;
    refreshPanel();
    draw();
  }

  function deleteSelected() {
    if (!state.selectedId) return;
    pushUndo();
    state.objects = state.objects.filter(function (o) { return o.id !== state.selectedId; });
    state.selectedId = null;
    refreshPanel();
    saveSoon();
    draw();
  }

  function refreshPanel() {
    const n = state.polygon.length;
    if (state.drawingGarden) {
      ui.gardenStatus.textContent = 'Drawing garden: ' + n + ' corner(s) so far. Click to add corners; double-click, right-click or click the first corner to close; Esc cancels a redraw.';
    } else if (n >= 3) {
      ui.gardenStatus.textContent = 'Garden polygon: ' + n + ' corners, tiled with ' + state.tileSize + ' cm tiles (' + getCells().length + ' tiles). Units on the canvas are centimetres.';
    } else {
      ui.gardenStatus.textContent = 'No garden yet. Pick the Garden tool and click on the canvas to add polygon corners; double-click or click the first corner to close the shape. Units on the canvas are centimetres.';
    }
    renderObjectList();
    renderEditor();
  }

  function renderObjectList() {
    ui.objectList.innerHTML = '';
    if (state.objects.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No objects yet.';
      ui.objectList.appendChild(li);
      return;
    }
    for (const o of state.objects) {
      const li = document.createElement('li');
      if (o.id === state.selectedId) li.classList.add('selected');
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = o.color || '#999';
      const txt = document.createElement('span');
      txt.textContent = (o.label || '(unlabelled)') + ' \u00b7 ' + o.type;
      li.appendChild(sw);
      li.appendChild(txt);
      li.addEventListener('click', function () { select(o.id); });
      ui.objectList.appendChild(li);
    }
  }

  function renderEditor() {
    const o = selectedObject();
    if (!o) {
      ui.objectEditor.hidden = true;
      ui.objHint.hidden = false;
      return;
    }
    ui.objHint.hidden = true;
    ui.objectEditor.hidden = false;
    ui.objLabel.value = o.label || '';
    ui.objColor.value = /^#[0-9a-fA-F]{6}$/.test(o.color || '') ? o.color : '#c98f4e';
    ui.objDesc.value = o.description || '';
    ui.geomRow.innerHTML = '';
    const mkNum = function (labelText, value, onChange, disabled) {
      const label = document.createElement('label');
      label.textContent = labelText + ' ';
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '1';
      input.value = String(Math.round(value * 10) / 10);
      if (disabled) input.disabled = true;
      input.addEventListener('input', function () {
        const v = parseFloat(input.value);
        if (isFinite(v)) { onChange(v); draw(); saveSoon(); }
      });
      label.appendChild(input);
      ui.geomRow.appendChild(label);
    };
    if (o.type === 'circle') {
      mkNum('Radius (cm)', o.r, function (v) { o.r = Math.max(MIN_SIZE, v); });
    } else {
      mkNum('Width (cm)', o.w, function (v) { o.w = Math.max(MIN_SIZE, v); if (o.type === 'square') o.h = o.w; });
      mkNum('Height (cm)', o.h, function (v) { o.h = Math.max(MIN_SIZE, v); }, o.type === 'square');
    }
    mkNum('X (cm)', o.x, function (v) { o.x = v; });
    mkNum('Y (cm)', o.y, function (v) { o.y = v; });
  }

  ui.objLabel.addEventListener('input', function () {
    const o = selectedObject();
    if (o) { o.label = ui.objLabel.value; renderObjectList(); draw(); saveSoon(); }
  });

  ui.objColor.addEventListener('input', function () {
    const o = selectedObject();
    if (o) { o.color = ui.objColor.value; renderObjectList(); draw(); saveSoon(); }
  });

  ui.objDesc.addEventListener('input', function () {
    const o = selectedObject();
    if (o) { o.description = ui.objDesc.value; saveSoon(); }
  });

  function zoomAt(sx, sy, factor) {
    const v = state.view;
    const sOld = v.zoom * PX_PER_CM;
    const wx = (sx - v.ox) / sOld;
    const wy = (sy - v.oy) / sOld;
    v.zoom = GardenCore.clamp(v.zoom * factor, 0.2, 8);
    const sNew = v.zoom * PX_PER_CM;
    v.ox = sx - wx * sNew;
    v.oy = sy - wy * sNew;
    ui.zoomLabel.textContent = Math.round(v.zoom * 100) + '%';
    draw();
  }

  function download(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  document.querySelectorAll('#modeGroup .mode').forEach(function (btn) {
    btn.addEventListener('click', function () { setMode(btn.dataset.mode); });
  });

  document.querySelectorAll('input[name="paint"]').forEach(function (r) {
    r.addEventListener('change', function () { state.paint = r.value; });
  });

  $('btnApplyTile').addEventListener('click', function () {
    const v = parseFloat(ui.tileSize.value);
    if (!isFinite(v) || v < 1) return;
    if (Math.abs(v - state.tileSize) > 1e-9) {
      pushUndo();
      state.tileSize = v;
      state.tiles.clear();
      saveSoon();
    }
    refreshPanel();
    draw();
  });

  $('btnDrawGarden').addEventListener('click', function () { setMode('garden'); startRedraw(); });
  $('btnFinishPolygon').addEventListener('click', function () { finishGarden(); draw(); });
  $('btnClearPolygon').addEventListener('click', function () {
    pushUndo();
    state.polygon = [];
    state.drawingGarden = false;
    state.prevPolygon = null;
    state.tiles.clear();
    saveSoon();
    refreshPanel();
    draw();
  });
  $('btnFillGrass').addEventListener('click', function () {
    if (!gardenDefined()) return;
    pushUndo();
    for (const cell of getCells()) state.tiles.set(GardenCore.cellKey(cell.col, cell.row), 'grass');
    saveSoon();
    draw();
  });
  $('btnFillStone').addEventListener('click', function () {
    if (!gardenDefined()) return;
    pushUndo();
    for (const cell of getCells()) state.tiles.set(GardenCore.cellKey(cell.col, cell.row), 'stone');
    saveSoon();
    draw();
  });
  $('btnClearTiles').addEventListener('click', function () {
    pushUndo();
    state.tiles.clear();
    saveSoon();
    draw();
  });
  $('btnDeleteObj').addEventListener('click', deleteSelected);
  $('btnUndo').addEventListener('click', undo);
  $('zoomIn').addEventListener('click', function () { zoomAt(cssW / 2, cssH / 2, 1.25); });
  $('zoomOut').addEventListener('click', function () { zoomAt(cssW / 2, cssH / 2, 0.8); });
  $('zoomReset').addEventListener('click', function () {
    state.view = { zoom: 1, ox: 60, oy: 60 };
    ui.zoomLabel.textContent = '100%';
    draw();
  });
  $('btnSave').addEventListener('click', function () {
    save();
    const b = $('btnSave');
    b.textContent = 'Saved';
    setTimeout(function () { b.textContent = 'Save'; }, 900);
  });
  $('btnLoad').addEventListener('click', function () {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { pushUndo(); loadFrom(JSON.parse(raw)); }
    } catch (err) {}
  });
  $('btnExport').addEventListener('click', function () {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
    download('garden-plan.json', blob);
  });
  $('btnImport').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function (e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        pushUndo();
        if (loadFrom(data)) saveSoon();
      } catch (err) {}
    };
    reader.readAsText(f);
    e.target.value = '';
  });
  $('btnPng').addEventListener('click', function () {
    canvas.toBlob(function (blob) { if (blob) download('garden-plan.png', blob); }, 'image/png');
  });

  window.addEventListener('resize', resize);
  loadSaved();
  resize();
  setMode('select');
  refreshPanel();
})();
