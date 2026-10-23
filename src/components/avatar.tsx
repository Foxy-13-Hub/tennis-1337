"use client";

import { useState } from "react";
import { slug } from "@/lib/demo-data";

export function Avatar({ name, image, size = 38 }: { name: string; image?: string; size?: number }) {
  const candidates = Array.from(new Set([
    image,
    `/players/${slug(name)}.png`,
    "/players/default.svg",
  ].filter((value): value is string => Boolean(value))));
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[Math.min(candidateIndex, candidates.length - 1)] || "/players/default.svg";
  return <img
    className="avatar"
    src={src}
    alt={`${name} profile`}
    width={size}
    height={size}
    loading="eager"
    onError={() => setCandidateIndex((index) => Math.min(index + 1, candidates.length - 1))}
    style={{ width: size, height: size, objectFit: "cover", flexShrink: 0 }}
  />;
}
