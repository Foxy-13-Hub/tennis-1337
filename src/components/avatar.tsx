'use client';

import { slug } from "@/lib/demo-data";
export function Avatar({ name, image, size = 38 }: { name: string; image?: string; size?: number }) {
  const src = image || `/players/${slug(name)}.png`;
  return <img className="avatar" src={src} alt={`${name} profile`} width={size} height={size}
    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/players/default.svg"; }}
    style={{ width:size, height:size }} />;
}
