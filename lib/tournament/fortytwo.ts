import { cache } from "react";

import { env } from "@/lib/env";

type FortyTwoProfile = {
  login: string;
  displayname: string | null;
  image?: {
    link?: string | null;
  };
  url?: string | null;
  location?: string | null;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

const fetchAccessToken = cache(async () => {
  if (!env.FORTY_TWO_CLIENT_ID || !env.FORTY_TWO_CLIENT_SECRET) {
    return null;
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  const response = await fetch("https://api.intra.42.fr/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.FORTY_TWO_CLIENT_ID,
      client_secret: env.FORTY_TWO_CLIENT_SECRET,
    }),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };

  return payload.access_token;
});

export const fetch42Profile = cache(async (login: string) => {
  try {
    const token = await fetchAccessToken();
    if (!token) {
      return null;
    }

    const headers = new Headers({ Accept: "application/json" });
    headers.set("Authorization", ["Bearer", token].join(" "));

    const response = await fetch(`${env.FORTY_TWO_API_BASE_URL}/users/${login}`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const profile = (await response.json()) as FortyTwoProfile;

    return {
      login: profile.login,
      displayName: profile.displayname ?? profile.login,
      avatarUrl: profile.image?.link ?? null,
      profileUrl: profile.url ?? null,
      location: profile.location ?? null,
    };
  } catch {
    return null;
  }
});
