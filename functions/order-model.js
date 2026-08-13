'use strict';

const DRINKS = Object.freeze({
  coffee: 'Кава',
  tea: 'Чай',
  cappuccino: 'Капучино',
  latte: 'Лате'
});

function clean(value, maximum = 80) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function orderPayload(body = {}) {
  const item = clean(body.item, 24).toLowerCase();
  if (!DRINKS[item]) throw new Error('Невідома позиція меню');
  return {
    item,
    label: DRINKS[item],
    sender: clean(body.sender, 60) || 'Гість Enjoy',
    game: clean(body.game, 80)
  };
}

function telegramOrderText(order, email = '') {
  const lines = [
    '☕ <b>Нове замовлення · Enjoy Mafia</b>',
    `Напій: <b>${escapeHtml(order.label)}</b>`,
    `Від: ${escapeHtml(order.sender)}`
  ];
  if (order.game) lines.push(`Гра: ${escapeHtml(order.game)}`);
  if (email) lines.push(`Акаунт: ${escapeHtml(clean(email, 120))}`);
  return lines.join('\n');
}

module.exports = { DRINKS, orderPayload, telegramOrderText };
