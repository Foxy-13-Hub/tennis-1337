"use client";

import { useState } from "react";
import Image from "next/image";
const slug = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function Avatar({ name, image, size = 38 }: { name: string; image?: string; size?: number }) {
  const candidates = Array.from(new Set([
    image,
    `/players/${slug(name)}.png`,
    "/players/default.svg",
  ].filter((value): value is string => Boolean(value))));
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[Math.min(candidateIndex, candidates.length - 1)] || "/players/default.svg";
  return <Image
    unoptimized
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
