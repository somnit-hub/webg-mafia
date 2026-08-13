'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { orderPayload, telegramOrderText } = require('./order-model');

initializeApp();

const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN');
const telegramChatId = defineSecret('ORDER_TELEGRAM_CHAT_ID');
const allowedOrigins = new Set([
  'https://mafia-cafe.web.app',
  'https://somnit-hub.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
]);

function allowCors(request, response) {
  const origin = request.get('origin') || '';
  if (allowedOrigins.has(origin) || /^http:\/\/(?:localhost|127[.]0[.]0[.]1):\d+$/.test(origin)) {
    response.set('Access-Control-Allow-Origin', origin);
    response.set('Vary', 'Origin');
  }
  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return !origin || allowedOrigins.has(origin) || /^http:\/\/(?:localhost|127[.]0[.]0[.]1):\d+$/.test(origin);
}

exports.sendTelegramOrder = onRequest({
  region: 'europe-west1',
  secrets: [telegramBotToken, telegramChatId],
  timeoutSeconds: 15,
  memory: '256MiB',
  maxInstances: 3
}, async (request, response) => {
  if (!allowCors(request, response)) return response.status(403).json({ error: 'Недозволений сайт' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Потрібен POST-запит' });

  try {
    const authorization = request.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return response.status(401).json({ error: 'Потрібен Google-вхід' });
    const identity = await getAuth().verifyIdToken(match[1]);
    if (!identity.email_verified) return response.status(403).json({ error: 'Email Google-акаунта не підтверджено' });

    const order = orderPayload(request.body);
    const now = Date.now();
    const rateLimit = getFirestore().doc(`communities/enjoy/orderRateLimits/${identity.uid}`);
    await getFirestore().runTransaction(async transaction => {
      const snapshot = await transaction.get(rateLimit);
      const lastOrderAt = Number(snapshot.data()?.lastOrderAt || 0);
      if (now - lastOrderAt < 5000) throw new Error('Зачекайте кілька секунд перед наступним замовленням');
      transaction.set(rateLimit, {
        lastOrderAt: now,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });

    const token = telegramBotToken.value();
    const chatId = telegramChatId.value();
    if (!token || !chatId) return response.status(503).json({ error: 'Telegram-одержувача ще не підключено' });
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramOrderText(order, identity.email || ''),
        parse_mode: 'HTML',
        disable_notification: false
      })
    });
    const telegramResult = await telegramResponse.json().catch(() => ({}));
    if (!telegramResponse.ok || !telegramResult.ok) {
      console.error('Telegram sendMessage failed', telegramResponse.status, telegramResult.description || 'Unknown error');
      return response.status(502).json({ error: 'Telegram не прийняв замовлення' });
    }
    return response.json({ ok: true, item: order.item, label: order.label });
  } catch (error) {
    const safeMessage = error?.message === 'Зачекайте кілька секунд перед наступним замовленням'
      ? error.message
      : 'Не вдалося надіслати замовлення';
    // Never log the fetch URL: it contains the Telegram bot token.
    console.error('Order delivery failed', { name: error?.name || 'Error' });
    return response.status(safeMessage.startsWith('Зачекайте') ? 429 : 500).json({ error: safeMessage });
  }
});
