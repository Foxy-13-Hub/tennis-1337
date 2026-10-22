"use client";

import { useState } from "react";
import { slug } from "@/lib/demo-data";

export function Avatar({ name, image, size = 38 }: { name: string; image?: string; size?: number }) {
  const login = name.trim();
  const localSrc = image || `/players/${slug(login)}.png`;
  const [src, setSrc] = useState(localSrc);

  function handleError() {
    if (src !== `https://cdn.intra.42.fr/users/${encodeURIComponent(login)}.jpg`) {
      setSrc(`https://cdn.intra.42.fr/users/${encodeURIComponent(login)}.jpg`);
      return;
    }
    if (src !== "/players/default.svg") {
      setSrc("/players/default.svg");
    }
  }

  return (
    <img
      className="avatar"
      src={src}
      alt={`${name} profile`}
      width={size}
      height={size}
      onError={handleError}
      style={{ width: size, height: size }}
    />
  );
}
