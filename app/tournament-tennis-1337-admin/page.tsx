export const dynamic = "force-dynamic";
import { AdminLoginForm } from "@/components/admin-login-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminActor } from "@/lib/auth";
import { getPublicTournamentState } from "@/lib/tournament/repository";

const sections = [
  "Overview",
  "Tournament configuration",
  "Player import",
  "Team management",
  "Corner team selection",
  "Bracket generation",
  "Match scheduling",
  "Score entry",
  "Result correction and undo",
  "Match history and audit",
  "Administrator settings",
];

export default async function AdminPage() {
  const admin = await getAdminActor();

  if (!admin) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
        <AdminLoginForm />
      </main>
    );
  }

  const state = await getPublicTournamentState();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Tournament Admin Dashboard</h1>
        <p className="text-sm text-zinc-300">
          Signed in as {admin.email} ({admin.role})
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardDescription>Total teams</CardDescription>
          <CardTitle>{state.teams.length}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Matches</CardDescription>
          <CardTitle>{state.matches.length}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Completed</CardDescription>
          <CardTitle>{state.matches.filter((item) => item.status === "completed").length}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Timezone</CardDescription>
          <CardTitle>{state.tournament?.timezone ?? "Africa/Casablanca"}</CardTitle>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section}>
            <CardTitle className="text-base">{section}</CardTitle>
          </Card>
        ))}
      </section>
    </main>
  );
}
