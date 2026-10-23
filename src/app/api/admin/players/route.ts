// Compatibility endpoint: player edits use the same authoritative state and
// revision protection as the dashboard, rather than a disconnected SQL table.
import { PATCH as updateTournament } from "../tournament/route";
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  return updateTournament(new Request(request.url, {
    method: "PATCH", headers: request.headers,
    body: JSON.stringify({ ...body, action: "rename" }),
  }));
}
