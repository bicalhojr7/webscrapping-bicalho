import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  GOOGLE_PLACES_API_KEY: z.string().trim().min(1).optional(),
  GOOGLE_PLACES_BASE_URL: z
    .string()
    .trim()
    .url()
    .default("https://places.googleapis.com/v1"),

  // Evolution API (WhatsApp)
  EVOLUTION_API_URL: z.string().trim().url().optional(),
  EVOLUTION_API_KEY: z.string().trim().min(1).optional(),
  EVOLUTION_INSTANCE: z.string().trim().min(1).optional(),

  // Stitch
  STITCH_API_KEY: z.string().trim().min(1).optional(),

  // Deployments (Sites Gen)
  SITES_GITHUB_TOKEN: z.string().trim().min(1).optional(),
  SITES_VERCEL_TOKEN: z.string().trim().min(1).optional(),
});

export const env = envSchema.parse(process.env);

export function requireGooglePlacesApiKey(): string {
  if (!env.GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY is required to search leads");
  }
  return env.GOOGLE_PLACES_API_KEY;
}

export function requireEvolutionConfig(): { url: string; apiKey: string; instance: string } {
  if (!env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY || !env.EVOLUTION_INSTANCE) {
    throw new Error(
      "Evolution API não configurada. Adicione EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE no .env"
    );
  }
  return {
    url: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instance: env.EVOLUTION_INSTANCE
  };
}

export function requireStitchApiKey(): string {
  if (!env.STITCH_API_KEY) {
    throw new Error("STITCH_API_KEY is required to generate sites");
  }
  return env.STITCH_API_KEY;
}
