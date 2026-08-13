const ORDER_ENDPOINT = 'https://enjoy-mafia-orders.webg-mafia.workers.dev/orders';

export async function sendTelegramOrder({ idToken, item, sender, game, testMode = false }) {
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
      body: JSON.stringify({ item, sender, game }),
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
