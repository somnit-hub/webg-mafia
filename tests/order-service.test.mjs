import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ORDER_MENU, loadOrderMenu, normalizeOrderMenu, sendTelegramOrder } from '../src/order-service.js';

test('local order smoke does not require a token or a network request', async () => {
  const result = await sendTelegramOrder({ item: 'latte', testMode: true });
  assert.deepEqual(result, { ok: true, item: 'latte', test: true });
});

test('remote menu is normalized, cached and falls back safely', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const menu = await loadOrderMenu({
    storage,
    fetchImpl: async () => Response.json({
      source: 'sheet',
      items: [{ id: ' cocoa ', labels: { uk: 'Какао' }, priceUah: 55, volumeMl: 300, icon: 'cocoa', sort: 5 }],
      options: [{ id: 'oat', itemId: 'cocoa', group: 'milk', labels: { uk: 'Вівсяне' }, priceDeltaUah: 20 }]
    })
  });
  assert.equal(menu.items[0].id, 'cocoa');
  assert.equal(menu.items[0].labels.en, 'Какао');
  assert.equal(menu.options[0].priceDeltaUah, 20);
  const cached = await loadOrderMenu({ storage, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(cached.items[0].id, 'cocoa');
  assert.equal(normalizeOrderMenu(DEFAULT_ORDER_MENU).items.length, 4);
});
