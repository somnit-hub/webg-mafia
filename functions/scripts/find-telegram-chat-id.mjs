import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function variables(file) {
  const text = await readFile(resolve(import.meta.dirname, '..', file), 'utf8').catch(() => '');
  return Object.fromEntries(text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));
}

const secrets = await variables('.secret.local');
const config = await variables('.env.local');
const token = secrets.TELEGRAM_BOT_TOKEN;
const username = String(config.ORDER_TELEGRAM_USERNAME || 'Chemelev').replace(/^@/, '').toLowerCase();
if (!token) throw new Error('Додайте TELEGRAM_BOT_TOKEN до functions/.secret.local');

const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const payload = await response.json();
if (!payload.ok) throw new Error(payload.description || 'Telegram не повернув оновлення');
const chats = payload.result
  .map(update => update.message?.chat || update.edited_message?.chat)
  .filter(chat => chat?.type === 'private');
const target = chats.reverse().find(chat => String(chat.username || '').toLowerCase() === username);
if (!target) throw new Error(`Відкрийте свого бота в Telegram, натисніть Start з акаунта @${username}, а потім повторіть команду`);
console.log(`ORDER_TELEGRAM_CHAT_ID=${target.id}`);
