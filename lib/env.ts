import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  FORTY_TWO_CLIENT_ID: z.string().optional(),
  FORTY_TWO_CLIENT_SECRET: z.string().optional(),
  FORTY_TWO_API_BASE_URL: z.string().url().default("https://api.intra.42.fr/v2"),
  TOURNAMENT_TIMEZONE: z.string().default("Africa/Casablanca"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  FORTY_TWO_CLIENT_ID: process.env.FORTY_TWO_CLIENT_ID,
  FORTY_TWO_CLIENT_SECRET: process.env.FORTY_TWO_CLIENT_SECRET,
  FORTY_TWO_API_BASE_URL: process.env.FORTY_TWO_API_BASE_URL,
  TOURNAMENT_TIMEZONE: process.env.TOURNAMENT_TIMEZONE,
});
