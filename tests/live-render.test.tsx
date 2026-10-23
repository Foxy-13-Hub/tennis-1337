import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { MatchCard } from "../src/components/match-card";
import { LiveControls } from "../src/components/live-controls";
import { demoTournament } from "../src/lib/demo-data";
describe("live score rendering",()=>{
 it("shows only persisted live scores and history",()=>{
  const m={...demoTournament.matches[0],status:"live" as const,gamesA:3,gamesB:1,setHistory:[{gamesA:6,gamesB:2}],setsA:[1]};
  const html=renderToStaticMarkup(<MatchCard match={m}/>);expect(html).toContain("LIVE");expect(html).toContain("1 [3]");expect(html).toContain("0 [1]");expect(html).toContain("6–2");
  expect(renderToStaticMarkup(<MatchCard match={{...m,status:"completed"}}/>)).not.toContain("LIVE");
  expect(renderToStaticMarkup(<MatchCard match={{...m,status:"upcoming"}}/>)).not.toContain("1 [3]");
 });
 it("guards controls during load/save and shows saved state",()=>{
  const m={...demoTournament.matches[0],status:"live" as const,gamesA:0,gamesB:0};
  const html=renderToStaticMarkup(<LiveControls match={m} busy send={()=>{}}/>);
  expect(html).toContain("Showing saved score");expect(html).toContain('disabled=""');expect(html).toContain("Saved: 0 [0]");
  expect(renderToStaticMarkup(<LiveControls match={{...m,status:"completed"}} busy={false} send={()=>{}}/>)).not.toContain("Save Score");
 });
});
