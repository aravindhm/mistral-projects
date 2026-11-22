'use strict';

const assert = require('assert');
const G = require('../garden-core.js');

const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

assert.strictEqual(G.pointInPolygon({ x: 5, y: 5 }, square), true, 'centre inside');
assert.strictEqual(G.pointInPolygon({ x: 15, y: 5 }, square), false, 'outside');
assert.strictEqual(G.pointInPolygon({ x: 0, y: 5 }, square), true, 'boundary counts as inside');
assert.strictEqual(G.pointInPolygon({ x: 10, y: 10 }, square), true, 'vertex counts as inside');
assert.strictEqual(G.pointInPolygon({ x: 5, y: 5 }, []), false, 'empty polygon');

const concave = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 5 }, { x: 0, y: 10 }];
assert.strictEqual(G.pointInPolygon({ x: 2, y: 2 }, concave), true, 'concave inside');
assert.strictEqual(G.pointInPolygon({ x: 5, y: 8 }, concave), false, 'concave notch outside');

const offsetSquare = [{ x: 2, y: 2 }, { x: 12, y: 2 }, { x: 12, y: 12 }, { x: 2, y: 12 }];
const cells = G.cellsForPolygon(offsetSquare, 5);
assert.strictEqual(cells.length, 4, '2x2 cells of 5cm in a 10x10 square offset by 2');
assert.deepStrictEqual(cells.map(c => G.cellKey(c.col, c.row)).sort(), ['0,0', '0,1', '1,0', '1,1']);

assert.strictEqual(G.cellsForPolygon(square, 0).length, 0, 'zero tile size yields no cells');
assert.strictEqual(G.cellsForPolygon([], 5).length, 0, 'no polygon yields no cells');

assert.deepStrictEqual(G.cellAt({ x: 7, y: -1 }, 5), { col: 1, row: -1 }, 'cellAt handles negatives');
assert.deepStrictEqual(G.cellCenter(1, -1, 5), { x: 7.5, y: -2.5 }, 'cellCenter');

const rect = G.makeObject('rect', { x: 0, y: 0, w: 10, h: 10, label: 'Bench', color: '#123456', description: 'seats 4' });
const circ = G.makeObject('circle', { x: 5, y: 5, r: 3 });
assert.ok(rect.id && circ.id && rect.id !== circ.id, 'unique ids');
assert.strictEqual(rect.label, 'Bench');
assert.strictEqual(rect.description, 'seats 4');
assert.strictEqual(G.makeObject('square', { w: 12 }).h, 12, 'square has equal sides');

assert.strictEqual(G.hitTest([rect, circ], { x: 5, y: 5 }).id, circ.id, 'topmost (last) wins');
assert.strictEqual(G.hitTest([rect, circ], { x: 9, y: 9 }).id, rect.id, 'rect hit outside circle');
assert.strictEqual(G.hitTest([rect], { x: 20, y: 20 }), null, 'miss returns null');
assert.strictEqual(G.objectContains(circ, { x: 5 + 3, y: 5 }), true, 'circle boundary inclusive');

const r = G.rectFromDrag(10, 10, 2, 4, { square: false });
assert.deepStrictEqual({ x: r.x, y: r.y, w: r.w, h: r.h }, { x: 2, y: 4, w: 8, h: 6 }, 'rect drag normalises negative direction');
const s = G.rectFromDrag(0, 0, -5, 3, { square: true });
assert.deepStrictEqual({ x: s.x, y: s.y, w: s.w, h: s.h }, { x: -5, y: 0, w: 5, h: 5 }, 'square drag anchored at start, max side');

assert.strictEqual(G.clamp(5, 0, 3), 3);
assert.strictEqual(G.clamp(-1, 0, 3), 0);
assert.strictEqual(G.clamp(2, 0, 3), 2);

const bounds = G.polygonBounds([{ x: -3, y: 7 }, { x: 4, y: -2 }]);
assert.deepStrictEqual(bounds, { minX: -3, minY: -2, maxX: 4, maxY: 7 });

console.log('All garden-core tests passed.');
