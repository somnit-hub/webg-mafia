const ORDER_ENDPOINT = 'https://enjoy-mafia-orders.webg-mafia.workers.dev/orders';
const MENU_ENDPOINT = 'https://enjoy-mafia-orders.webg-mafia.workers.dev/menu';
const MENU_CACHE_KEY = 'mafia-enjoy-order-menu-v1';

export const DEFAULT_ORDER_MENU = Object.freeze({
  items: Object.freeze([
    { id: 'coffee', category: 'coffee', labels: { uk: 'Кава', it: 'Caffè', en: 'Coffee', fr: 'Café' }, icon: 'coffee', sort: 10 },
    { id: 'tea', category: 'tea', labels: { uk: 'Чай', it: 'Tè', en: 'Tea', fr: 'Thé' }, icon: 'tea', sort: 20 },
    { id: 'cappuccino', category: 'coffee', labels: { uk: 'Капучино', it: 'Cappuccino', en: 'Cappuccino', fr: 'Cappuccino' }, icon: 'cappuccino', sort: 30 },
    { id: 'latte', category: 'coffee', labels: { uk: 'Лате', it: 'Latte', en: 'Latte', fr: 'Latte' }, icon: 'latte', sort: 40 }
  ]),
  options: Object.freeze([]),
  source: 'fallback'
});

function clean(value, maximum = 120) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function finiteNumber(value, minimum = 0, maximum = 100000) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function normalizeLabels(value = {}, fallback = '') {
  const uk = clean(value.uk || fallback, 80);
  if (!uk) return null;
  return {
    uk,
    it: clean(value.it || uk, 80),
    en: clean(value.en || uk, 80),
    fr: clean(value.fr || uk, 80)
  };
}

export function normalizeOrderMenu(value) {
  const ids = new Set();
  const items = (Array.isArray(value?.items) ? value.items : []).map(item => {
    const id = clean(item?.id, 48).toLowerCase();
    const labels = normalizeLabels(item?.labels, item?.label);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(id) || ids.has(id) || !labels) return null;
    ids.add(id);
    return {
      id,
      category: clean(item.category, 32).toLowerCase() || 'other',
      labels,
      priceUah: finiteNumber(item.priceUah),
      volumeMl: finiteNumber(item.volumeMl, 1, 5000),
      icon: clean(item.icon, 32).toLowerCase() || 'coffee',
      sort: finiteNumber(item.sort, -100000, 100000) ?? 0,
      descriptionUk: clean(item.descriptionUk, 240)
    };
  }).filter(Boolean).sort((left, right) => left.sort - right.sort || left.labels.uk.localeCompare(right.labels.uk, 'uk'));
  if (!items.length) throw new Error('Меню не містить доступних позицій');

  const optionIds = new Set();
  const options = (Array.isArray(value?.options) ? value.options : []).map(option => {
    const id = clean(option?.id || option?.optionId, 48).toLowerCase();
    const itemId = clean(option?.itemId, 48).toLowerCase();
    const labels = normalizeLabels(option?.labels, option?.label);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(id) || optionIds.has(id) || !ids.has(itemId) || !labels) return null;
    optionIds.add(id);
    return {
      id,
      itemId,
      group: clean(option.group, 32).toLowerCase() || 'extra',
      labels,
      priceDeltaUah: finiteNumber(option.priceDeltaUah, -100000, 100000) ?? 0,
      sort: finiteNumber(option.sort, -100000, 100000) ?? 0
    };
  }).filter(Boolean).sort((left, right) => left.sort - right.sort || left.labels.uk.localeCompare(right.labels.uk, 'uk'));

  return { items, options, source: clean(value?.source, 24) || 'sheet', updatedAt: clean(value?.updatedAt, 40) };
}

function cachedMenu(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(MENU_CACHE_KEY) || 'null');
    return saved ? normalizeOrderMenu(saved) : null;
  } catch {
    return null;
  }
}

export async function loadOrderMenu({ testMode = false, fetchImpl = globalThis.fetch, storage = globalThis.localStorage } = {}) {
  const cached = cachedMenu(storage);
  if (testMode || typeof fetchImpl !== 'function') return cached || DEFAULT_ORDER_MENU;
  try {
    const response = await fetchImpl(MENU_ENDPOINT, { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Меню тимчасово недоступне');
    const menu = normalizeOrderMenu(payload);
    try { storage?.setItem(MENU_CACHE_KEY, JSON.stringify(menu)); } catch { /* A live menu still works without storage. */ }
    return menu;
  } catch {
    return cached || DEFAULT_ORDER_MENU;
  }
}

export async function sendTelegramOrder({ idToken, item, options = [], sender, game, testMode = false }) {
  if (testMode) {
    await new Promise(resolve => setTimeout(resolve, 80));
    return { ok: true, item, test: true };
  }
  if (!idToken) throw new Error('Спочатку увійдіть через Google');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(ORDER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ item, options, sender, game }),
      signal: controller.signal
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Сервіс замовлень тимчасово недоступний');
    return result;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Telegram не відповів вчасно');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
