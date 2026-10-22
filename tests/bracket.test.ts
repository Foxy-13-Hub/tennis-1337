import { describe, expect, it } from "vitest";
import { generateBracket } from "../src/lib/bracket";
import type { Team } from "../src/lib/types";
const team=(id:string):Team=>({id,name:id,players:[{id:id+"a",name:id+" A",image:""},{id:id+"b",name:id+" B",image:""}]});
const teams=Array.from({length:8},(_,i)=>team(`t${i+1}`));
const corners={topLeft:"t1",bottomLeft:"t2",topRight:"t3",bottomRight:"t4"};
describe("generateBracket",()=>{
 it("preserves all four selected corners",()=>{
  const matches=generateBracket(teams,corners,()=>0.4);
  const first=matches.filter(m=>m.round===1);
  expect(first[0].teamA?.id).toBe("t1");
  expect(first[1].teamB?.id).toBe("t2");
  expect(first[2].teamA?.id).toBe("t3");
  expect(first[3].teamB?.id).toBe("t4");
 });
 it("does not duplicate teams in first round",()=>{
  const matches=generateBracket(teams,corners);
  const ids=matches.filter(m=>m.round===1).flatMap(m=>[m.teamA?.id,m.teamB?.id]).filter(Boolean);
  expect(new Set(ids).size).toBe(teams.length);
 });
 it("rejects duplicate corner selection",()=>{
  expect(()=>generateBracket(teams,{...corners,bottomLeft:"t1"})).toThrow();
 });
});
