import assert from 'node:assert/strict';
import test from 'node:test';
import { sendTelegramOrder } from '../src/order-service.js';

test('local order smoke does not require a token or a network request', async () => {
  const result = await sendTelegramOrder({ item: 'latte', testMode: true });
  assert.deepEqual(result, { ok: true, item: 'latte', test: true });
});
