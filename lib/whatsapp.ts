"use server";
import { env } from 'process';
const EVOLUTION_API_URL = 'https://whatsapp-ecostone.onrender.com';
const EVOLUTION_API_KEY = 'Gabriel2006!';
const INSTANCE_NAME = 'ecostone';

interface SendTextOptions { number: string; text: string; delay?: number; }
interface SendFileOptions { number: string; base64: string; fileName: string; caption?: string; mimetype?: string; delay?: number; }

function formatNumber(number: string): string {
  if (number.includes('@g.us') || number.includes('-')) return number;
  const clean = number.replace(/\D/g, '');
  if (clean.startsWith('55') && clean.length >= 12) return clean;
  if (clean.length === 10 || clean.length === 11) return `55${clean}`;
  return clean;
}

export async function wakeEvolutionServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${EVOLUTION_API_URL}`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    return res?.ok || false;
  } catch { return false; }
}

async function ensureEvolutionConnected(maxWaitSeconds = 50): Promise<void> {
  const startTime = Date.now();
  fetch(`${EVOLUTION_API_URL}`).catch(() => {});

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
        headers: { 'apikey': EVOLUTION_API_KEY },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.instance?.state === 'open') return;
      }
    } catch (e: any) {}
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

export async function sendWhatsAppText({ number, text, delay = 1200 }: SendTextOptions) {
  try {
    const formattedNumber = formatNumber(number);
    await ensureEvolutionConnected();
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ number: formattedNumber, options: { delay: delay, presence: 'composing', linkPreview: false }, text: text })
    });
    if (!response.ok) throw new Error(`Falha ao enviar mensagem`);
    return await response.json();
  } catch (error) { throw error; }
}

export async function sendWhatsAppMessage(number: string, text: string) {
  return sendWhatsAppText({ number, text });
}


export async function sendWhatsAppFile({ number, base64, fileName, caption = '', mimetype = 'application/pdf', delay = 1500 }: SendFileOptions) {
  try {
    const formattedNumber = formatNumber(number);
    await ensureEvolutionConnected();
    let cleanBase64 = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ number: formattedNumber, options: { delay: delay, presence: 'composing' }, mediatype: 'document', mimetype: mimetype, caption: caption, media: cleanBase64, fileName: fileName })
    });
    if (!response.ok) throw new Error(`Falha ao enviar arquivo`);
    return await response.json();
  } catch (error) { throw error; }
}

export async function createWhatsAppGroup(subject: string, participants: string[]) {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/group/create/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ subject: subject, description: 'Grupo criado via Sistema', participants: participants.map(formatNumber) })
    });
    if (!response.ok) throw new Error(`Falha ao criar grupo`);
    return await response.json();
  } catch (error) { throw error; }
}

export async function checkWhatsAppNumber(number: string) {
  try {
    await ensureEvolutionConnected();
    const response = await fetch(`${EVOLUTION_API_URL}/chat/checkNumber/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ numbers: [formatNumber(number)] })
    });
    if (!response.ok) throw new Error('Falha ao verificar');
    const data = await response.json();
    return (Array.isArray(data) && data.length > 0) ? data[0] : data;
  } catch (error) { return { exists: false }; }
}

export async function getEvolutionConnectionState() {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, { headers: { 'apikey': EVOLUTION_API_KEY } });
    if (!response.ok) return { state: 'close' };
    const data = await response.json();
    return { state: data?.instance?.state || 'close' };
  } catch { return { state: 'close' }; }
}

export async function connectEvolutionInstance() {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`, { headers: { 'apikey': EVOLUTION_API_KEY } });
    if (!response.ok) throw new Error('Falha ao solicitar conexão');
    return await response.json();
  } catch (error) { throw error; }
}

export async function logoutEvolutionInstance() {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/instance/logout/${INSTANCE_NAME}`, { method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY } });
    if (!response.ok) throw new Error('Falha ao deslogar');
    return await response.json();
  } catch (error) { throw error; }
}

export async function setEvolutionWebhook(webhookUrl: string) {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ enabled: true, url: webhookUrl, webhookByEvents: false, events: ['MESSAGES_UPSERT'] })
    });
    if (!response.ok) throw new Error('Falha ao configurar webhook');
    return await response.json();
  } catch (error) { throw error; }
}
