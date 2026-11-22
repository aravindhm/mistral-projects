(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GardenCore = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let idCounter = 0;

  function nextId(prefix) {
    idCounter += 1;
    return prefix + '-' + Date.now().toString(36) + '-' + idCounter.toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pointOnSegment(px, py, x1, y1, x2, y2) {
    const cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
    if (Math.abs(cross) > 1e-9) return false;
    const dot = (px - x1) * (x2 - x1) + (py - y1) * (y2 - y1);
    if (dot < -1e-9) return false;
    const lenSq = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (dot > lenSq + 1e-9) return false;
    return true;
  }

  function pointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return false;
    const x = point.x;
    const y = point.y;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      if (pointOnSegment(x, y, xi, yi, xj, yj)) return true;
      const intersects = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function polygonBounds(polygon) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of polygon) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function cellKey(col, row) {
    return col + ',' + row;
  }

  function cellAt(point, tileSize) {
    return { col: Math.floor(point.x / tileSize), row: Math.floor(point.y / tileSize) };
  }

  function cellCenter(col, row, tileSize) {
    return { x: (col + 0.5) * tileSize, y: (row + 0.5) * tileSize };
  }

  function cellsForPolygon(polygon, tileSize) {
    const cells = [];
    if (!polygon || polygon.length < 3 || !(tileSize > 0)) return cells;
    const b = polygonBounds(polygon);
    const col0 = Math.floor(b.minX / tileSize);
    const col1 = Math.floor(b.maxX / tileSize);
    const row0 = Math.floor(b.minY / tileSize);
    const row1 = Math.floor(b.maxY / tileSize);
    for (let col = col0; col <= col1; col++) {
      for (let row = row0; row <= row1; row++) {
        const c = cellCenter(col, row, tileSize);
        if (pointInPolygon(c, polygon)) {
          cells.push({ col: col, row: row, x: c.x, y: c.y });
        }
      }
    }
    return cells;
  }

  function makeObject(type, props) {
    const base = {
      id: nextId('obj'),
      type: type,
      color: '#c98f4e',
      label: '',
      description: '',
      x: 0,
      y: 0,
    };
    if (type === 'circle') {
      base.r = 20;
    } else {
      base.w = 40;
      base.h = 25;
      if (type === 'square') base.h = base.w;
    }
    const obj = Object.assign(base, props || {});
    if (obj.type === 'square') obj.h = obj.w;
    return obj;
  }

  function objectContains(obj, p) {
    if (obj.type === 'circle') {
      const dx = p.x - obj.x;
      const dy = p.y - obj.y;
      return dx * dx + dy * dy <= obj.r * obj.r;
    }
    return p.x >= obj.x && p.x <= obj.x + obj.w && p.y >= obj.y && p.y <= obj.y + obj.h;
  }

  function hitTest(objects, p) {
    for (let i = objects.length - 1; i >= 0; i--) {
      if (objectContains(objects[i], p)) return objects[i];
    }
    return null;
  }

  function rectFromDrag(x1, y1, x2, y2, opts) {
    const square = !!(opts && opts.square);
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (square) {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      return {
        x: dx >= 0 ? x1 : x1 - side,
        y: dy >= 0 ? y1 : y1 - side,
        w: side,
        h: side,
      };
    }
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(dx),
      h: Math.abs(dy),
    };
  }

  return {
    nextId: nextId,
    clamp: clamp,
    pointOnSegment: pointOnSegment,
    pointInPolygon: pointInPolygon,
    polygonBounds: polygonBounds,
    cellKey: cellKey,
    cellAt: cellAt,
    cellCenter: cellCenter,
    cellsForPolygon: cellsForPolygon,
    makeObject: makeObject,
    objectContains: objectContains,
    hitTest: hitTest,
    rectFromDrag: rectFromDrag,
  };
});
