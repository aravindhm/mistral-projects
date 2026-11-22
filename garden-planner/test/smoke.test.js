'use strict';

const assert = require('assert');

global.GardenCore = require('../garden-core.js');

function makeEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    listeners: {},
    style: {},
    dataset: {},
    value: '',
    hidden: false,
    textContent: '',
    files: [],
    _innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener() {},
    click() { (this.listeners.click || []).forEach(fn => fn({ target: el, preventDefault() {} })); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
    setPointerCapture() {},
    blur() {},
    remove() {},
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._innerHTML; },
    set(v) { this._innerHTML = v; if (v === '') this.children = []; },
  });
  return el;
}

const ctxStub = new Proxy({}, {
  get(t, prop) { return function () {}; },
  set() { return true; },
});

const byId = {};
const idList = ['canvas', 'tooltip', 'canvasWrap', 'tileSize', 'gardenStatus', 'objectList',
  'objectEditor', 'objHint', 'objLabel', 'objColor', 'objDesc', 'geomRow', 'zoomLabel',
  'btnApplyTile', 'btnDrawGarden', 'btnFinishPolygon', 'btnClearPolygon', 'btnFillGrass',
  'btnFillStone', 'btnClearTiles', 'btnDeleteObj', 'btnUndo', 'zoomIn', 'zoomOut', 'zoomReset',
  'btnSave', 'btnLoad', 'btnExport', 'btnImport', 'importFile', 'btnPng', 'paintGroup', 'modeGroup'];
for (const id of idList) byId[id] = makeEl(id === 'canvas' ? 'canvas' : 'div');
byId.canvas.getContext = () => ctxStub;
byId.canvas.toBlob = (cb) => cb(null);

global.window = {
  devicePixelRatio: 1,
  innerWidth: 1200,
  innerHeight: 800,
  listeners: {},
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
};
global.document = {
  body: makeEl('body'),
  getElementById(id) { return byId[id] || (byId[id] = makeEl('div')); },
  createElement(tag) { return makeEl(tag); },
  querySelectorAll(sel) {
    if (sel === '#modeGroup .mode') {
      return ['select', 'garden', 'paint', 'rect', 'square', 'circle'].map(m => {
        const b = makeEl('button');
        b.dataset.mode = m;
        return b;
      });
    }
    if (sel === 'input[name="paint"]') {
      return ['grass', 'stone'].map(v => { const r = makeEl('input'); r.value = v; return r; });
    }
    return [];
  },
};
const store = {};
global.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
};
global.URL = { createObjectURL() { return 'blob:stub'; }, revokeObjectURL() {} };

require('../app.js');

function fire(el, type, ev) {
  ev = ev || {};
  ev.preventDefault = ev.preventDefault || function () {};
  (el.listeners[type] || []).forEach(fn => fn(ev));
}
function key(k, extra) {
  fire(global.window, 'keydown', Object.assign({ key: k, target: { tagName: 'BODY' }, preventDefault() {} }, extra));
}
function pointer(type, x, y) {
  fire(byId.canvas, type, { clientX: x, clientY: y, button: 0, pointerId: 1, target: byId.canvas, preventDefault() {} });
}

(async function run() {
  fire(global.window, 'resize', {});

  key('g');
  pointer('pointerdown', 100, 100); pointer('pointerup', 100, 100);
  pointer('pointerdown', 260, 100); pointer('pointerup', 260, 100);
  pointer('pointerdown', 260, 220); pointer('pointerup', 260, 220);
  pointer('pointerdown', 100, 220); pointer('pointerup', 100, 220);
  pointer('pointerdown', 100, 100); pointer('pointerup', 100, 100);

  key('p');
  pointer('pointerdown', 140, 140);
  pointer('pointermove', 180, 140);
  pointer('pointermove', 180, 180);
  pointer('pointerup', 180, 180);

  key('r');
  pointer('pointerdown', 120, 120); pointer('pointermove', 200, 180); pointer('pointerup', 200, 180);

  key('s');
  pointer('pointerdown', 220, 200); pointer('pointermove', 250, 230); pointer('pointerup', 250, 230);

  key('c');
  pointer('pointerdown', 150, 190); pointer('pointermove', 175, 190); pointer('pointerup', 175, 190);

  key('v');
  pointer('pointerdown', 160, 150); pointer('pointerup', 160, 150);

  byId.objLabel.value = 'Bench';
  fire(byId.objLabel, 'input', { target: byId.objLabel });
  byId.objDesc.value = 'Seats four people';
  fire(byId.objDesc, 'input', { target: byId.objDesc });
  byId.objColor.value = '#aa3344';
  fire(byId.objColor, 'input', { target: byId.objColor });

  pointer('pointermove', 160, 150);
  assert.strictEqual(byId.tooltip.hidden, false, 'hover over labelled rect shows tooltip');
  pointer('pointermove', 700, 500);
  assert.strictEqual(byId.tooltip.hidden, true, 'tooltip hides when hovering empty space');

  pointer('pointerdown', 150, 190); pointer('pointerup', 150, 190);
  key('Delete');

  byId.btnSave.click();
  const saved = JSON.parse(store['garden-planner-v1']);
  assert.strictEqual(saved.polygon.length, 4, 'polygon saved with 4 corners');
  assert.ok(saved.tiles.length > 0, 'painted tiles saved');
  assert.ok(saved.tiles.every(t => t[1] === 'grass' || t[1] === 'stone'), 'tile kinds valid');
  assert.strictEqual(saved.objects.length, 2, 'circle deleted, rect+square remain');
  const rectObj = saved.objects.find(o => o.type === 'rect');
  assert.strictEqual(rectObj.label, 'Bench', 'label edit persisted');
  assert.strictEqual(rectObj.description, 'Seats four people', 'description edit persisted');
  assert.strictEqual(rectObj.color, '#aa3344', 'colour edit persisted');
  const sq = saved.objects.find(o => o.type === 'square');
  assert.strictEqual(sq.w, sq.h, 'square saved with equal sides');
  const ci = saved.objects.find(o => o.type === 'circle');
  assert.ok(!ci, 'circle was deleted');

  key('z', { ctrlKey: true });
  byId.btnSave.click();
  const afterUndo = JSON.parse(store['garden-planner-v1']);
  assert.strictEqual(afterUndo.objects.length, 3, 'undo restored the deleted circle');

  console.log('Smoke test passed: full session simulated (polygon, tiles, 3 object types, hover, edit, delete, undo, save).');
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
