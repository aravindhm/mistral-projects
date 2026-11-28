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

assert.strictEqual(G.formatLength(12.34), '12.3 cm', 'sub-100cm keeps one decimal');
assert.strictEqual(G.formatLength(126.7), '127 cm', '100cm and up rounds to whole cm');
assert.strictEqual(G.formatLength(0), '0 cm');
assert.strictEqual(G.formatLength(NaN), '');

assert.deepStrictEqual(G.snapToAxis({ x: 10, y: 10 }, { x: 50.75, y: 10.75 }), { x: 50.75, y: 10 }, 'dominant dx snaps to horizontal axis');
assert.deepStrictEqual(G.snapToAxis({ x: 10, y: 10 }, { x: 12, y: 30 }), { x: 10, y: 30 }, 'dominant dy snaps to vertical axis');
assert.deepStrictEqual(G.snapToAxis({ x: 0, y: 0 }, { x: 5, y: 5 }), { x: 5, y: 0 }, 'tie snaps horizontal');
assert.deepStrictEqual(G.snapToAxis({ x: -3, y: 4 }, { x: -8, y: 2 }), { x: -8, y: 4 }, 'negative coords keep the axis value');

assert.strictEqual(G.makeObject('rect', {}).rotation, 0, 'objects default to 0 degrees rotation');

const rot = G.makeObject('rect', { x: 0, y: 0, w: 20, h: 10, rotation: 90 });
assert.strictEqual(G.objectContains(rot, { x: 10, y: 12 }), true, 'rotated rect hit accounts for rotation');
assert.strictEqual(G.objectContains(G.makeObject('rect', { x: 0, y: 0, w: 20, h: 10, rotation: 0 }), { x: 10, y: 12 }), false, 'same point outside when unrotated');
assert.deepStrictEqual(G.objectCenter(rot), { x: 10, y: 5 }, 'rect centre');
assert.deepStrictEqual(G.objectCenter(G.makeObject('circle', { x: 3, y: 4, r: 5 })), { x: 3, y: 4 }, 'circle centre is its position');

const rp = G.rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
assert.ok(Math.abs(rp.x) < 1e-9 && Math.abs(rp.y - 1) < 1e-9, 'rotatePoint 90deg maps (1,0) to (0,1)');

const bb = G.objectBounds(rot);
assert.ok(Math.abs(bb.minX - 5) < 1e-9 && Math.abs(bb.maxX - 15) < 1e-9 && Math.abs(bb.minY + 5) < 1e-9 && Math.abs(bb.maxY - 15) < 1e-9, 'bounds of 90deg-rotated 20x10 rect');

assert.strictEqual(G.normAngle(-15), 345, 'normAngle wraps negatives');
assert.strictEqual(G.normAngle(370), 10, 'normAngle wraps over 360');
assert.strictEqual(G.snapAngle(8, 15), 15, 'snapAngle rounds to nearest step');
assert.strictEqual(G.snapAngle(7, 15), 0, 'snapAngle below half step');
assert.strictEqual(G.snapAngle(-100, 15), 255, 'snapAngle normalizes');

const bounds = G.polygonBounds([{ x: -3, y: 7 }, { x: 4, y: -2 }]);
assert.deepStrictEqual(bounds, { minX: -3, minY: -2, maxX: 4, maxY: 7 });

console.log('All garden-core tests passed.');
