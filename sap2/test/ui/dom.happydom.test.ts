// dom.ts under happy-dom (blueprint §4.5): setters are idempotent and never stomp a
// focused field; the keyed reconciler preserves nodes (and their focus) across
// reorder; swap's production guard throws on focus/canvas/[data-retain]; the
// scheduler coalesces to one flush per microtask; the failure latch isolates a
// broken region without loops.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { DomGuardError, latched, list, makeScheduler, setText, setValue, swap } from '../../src/ui/dom';

// happy-dom Windows hold live handles; close them or the test process never exits.
const openWindows: Window[] = [];
after(async () => {
  for (const w of openWindows) await w.happyDOM.close();
});

const dom = (): { doc: Document; root: HTMLElement } => {
  const w = new Window();
  openWindows.push(w);
  const doc = w.document as unknown as Document;
  const root = doc.createElement('div');
  doc.body.appendChild(root);
  return { doc, root };
};

test('setValue never stomps the focused field', () => {
  const { doc, root } = dom();
  const input = doc.createElement('input');
  root.appendChild(input);
  input.value = 'user is typing';
  input.focus();
  setValue(input, 'model value');
  assert.equal(input.value, 'user is typing');
  (doc.body as HTMLElement).focus();
  setValue(input, 'model value');
  assert.equal(input.value, 'model value');
});

test('keyed list reconciler reuses nodes across reorder and preserves focus', () => {
  const { doc, root } = dom();
  const spec = {
    key: (s: string) => s,
    create: (s: string) => {
      const li = doc.createElement('li');
      const input = doc.createElement('input');
      input.setAttribute('data-name', s);
      li.appendChild(input);
      return li;
    },
    update: (): void => {},
  };
  list(root, ['a', 'b', 'c'], spec);
  const bInput = root.querySelector('[data-name="b"]') as HTMLInputElement;
  const bRow = bInput.parentElement as HTMLElement;
  bInput.value = 'typed state';
  bInput.focus();

  // 'c' jumps to the front; a→b stay in relative order, so the minimal-move
  // reconciler must not touch them — focus survives (moving a node blurs it in any
  // DOM, so minimal moves IS the focus guarantee).
  list(root, ['c', 'a', 'b'], spec);
  // Identity comparisons on DOM nodes use ok(===): assert.equal's diff printer
  // deep-inspects happy-dom's circular element graph and never returns.
  assert.ok(root.querySelector('[data-name="b"]')?.parentElement === bRow, 'row b must be the SAME node');
  assert.ok(doc.activeElement === bInput, 'focus must survive a reorder that keeps b in relative order');
  assert.equal([...root.children].map((c) => c.querySelector('input')?.getAttribute('data-name')).join(''), 'cab');

  // Full reversal inherently moves ≥2 rows — identity and typed state still survive.
  list(root, ['c', 'b', 'a'], spec);
  assert.equal(root.children.length, 3);
  assert.ok(root.querySelector('[data-name="b"]')?.parentElement === bRow, 'row identity survives reversal');
  assert.equal((root.querySelector('[data-name="b"]') as HTMLInputElement).value, 'typed state');
  assert.equal([...root.children].map((c) => c.querySelector('input')?.getAttribute('data-name')).join(''), 'cba');

  list(root, ['b'], spec);
  assert.equal(root.children.length, 1);
});

test('swap guards: focused element, canvas, and [data-retain] all throw', () => {
  const { doc, root } = dom();
  const region = doc.createElement('div');
  root.appendChild(region);

  const input = doc.createElement('input');
  region.appendChild(input);
  input.focus();
  assert.throws(() => swap(region, '<p>new</p>'), DomGuardError);

  (doc.body as HTMLElement).focus();
  swap(region, '<p>new</p>');
  assert.equal(region.innerHTML, '<p>new</p>');

  region.innerHTML = '<canvas></canvas>';
  assert.throws(() => swap(region, '<p>x</p>'), DomGuardError);
  region.innerHTML = '<div data-retain></div>';
  assert.throws(() => swap(region, '<p>x</p>'), DomGuardError);
});

test('scheduler coalesces many requests into one flush', async () => {
  let flushes = 0;
  const schedule = makeScheduler(() => { flushes += 1; });
  schedule(); schedule(); schedule();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(flushes, 1);
  schedule();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(flushes, 2);
});

test('failure latch renders an error card once and stops that region only', () => {
  const { root } = dom();
  let calls = 0;
  const render = latched(root, 'test', () => {
    calls += 1;
    throw new Error('boom');
  });
  render();
  render();
  render();
  assert.equal(calls, 1, 'latched region must not re-run after failure');
  assert.match(root.textContent ?? '', /test panel hit an error/);
  assert.equal(root.querySelector('.error-card')?.getAttribute('role'), 'alert');
});

test('setText is idempotent (no churn when unchanged)', () => {
  const { doc } = dom();
  const el = doc.createElement('span');
  setText(el, 'x');
  const before = el.firstChild;
  setText(el, 'x');
  assert.ok(el.firstChild === before);
});
