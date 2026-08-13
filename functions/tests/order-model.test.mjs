import assert from 'node:assert/strict';
import test from 'node:test';
import model from '../order-model.js';

test('order menu accepts only known drinks and escapes Telegram HTML', () => {
  const order = model.orderPayload({ item: 'cappuccino', sender: '<Host>', game: 'Гра & кава' });
  assert.equal(order.label, 'Капучино');
  const text = model.telegramOrderText(order, 'host@example.com');
  assert.match(text, /<b>Капучино<\/b>/);
  assert.match(text, /&lt;Host&gt;/);
  assert.match(text, /Гра &amp; кава/);
  assert.throws(() => model.orderPayload({ item: 'unknown' }), /Невідома позиція/);
});
