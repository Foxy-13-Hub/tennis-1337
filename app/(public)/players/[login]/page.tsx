export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetch42Profile } from "@/lib/tournament/fortytwo";
import { getPublicTournamentState } from "@/lib/tournament/repository";

export default async function PlayerPage({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const state = await getPublicTournamentState();
  const localPlayer = state.players.find((player) => player.login === login);
  const profile = await fetch42Profile(login);

  if (!localPlayer && !profile) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{profile?.displayName ?? localPlayer?.display_name ?? login}</h1>
      <Card>
        <CardTitle>{login}</CardTitle>
        <CardDescription>
          {profile?.profileUrl ? (
            <a href={profile.profileUrl} target="_blank" rel="noreferrer" className="text-emerald-300 hover:text-emerald-200">42 profile</a>
          ) : (
            "42 profile currently unavailable"
          )}
        </CardDescription>
      </Card>
    </section>
  );
}
