import { requireEvolutionConfig } from "../config/env.js";

export interface SendWhatsAppTextInput {
  /** Número no formato 5548999999999 (com DDI + DDD, sem espaços ou símbolos) */
  number: string;
  text: string;
  /** Delay de digitação em ms para simular humano (padrão: 1200ms) */
  delayMs?: number;
}

export interface SendWhatsAppTextResult {
  messageId: string;
  status: string;
  number: string;
}

/**
 * Normaliza o número para o formato internacional sem caracteres especiais.
 * Ex: "+55 (48) 9 9612-6491" → "5548996126491"
 */
export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  // Se já começa com 55 e tem comprimento de número BR, mantém
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }

  // Adiciona DDI Brasil se não tiver
  return `55${digits}`;
}

/**
 * Envia uma mensagem de texto via Evolution API (WhatsApp).
 */
export async function sendWhatsAppText(input: SendWhatsAppTextInput): Promise<SendWhatsAppTextResult> {
  const config = requireEvolutionConfig();

  const normalizedNumber = normalizePhoneNumber(input.number);
  const delay = input.delayMs ?? 1200;

  const body = {
    number: normalizedNumber,
    text: input.text,
    options: {
      delay,
      presence: "composing",
      linkPreview: true
    }
  };

  const baseUrl = config.url.endsWith("/") ? config.url.slice(0, -1) : config.url;

  const response = await fetch(
    `${baseUrl}/message/sendText/${config.instance}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Evolution API falhou com status ${response.status}: ${errText}`);
  }

  const data = await response.json() as any;

  return {
    messageId: data.key?.id ?? data.id ?? "unknown",
    status: data.status ?? "SENT",
    number: normalizedNumber
  };
}

/**
 * Verifica se a Evolution API está configurada no .env.
 */
export function isEvolutionConfigured(): boolean {
  try {
    requireEvolutionConfig();
    return true;
  } catch {
    return false;
  }
}
