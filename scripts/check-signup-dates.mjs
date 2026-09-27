import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// Run from the repository root with Node >= 24. No credentials or network calls.
const source = fs.readFileSync("server/dashboard.ts", "utf8")
  .replace('import { ENV } from "./_core/env";', 'const ENV = {};');
const js = stripTypeScriptTypes(source);
const { dashboardInternals: api } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const headers = ["Case Status", "Call In Date", "SC Status", "SC Status Date", "Signed Up Date", "PRHB Status Date"];
const examples = [
  ["explicit September signup despite August enquiry", ["Signed Up","01/08/2026","","","20/09/2026",""],1,0],
  ["SC signup with matching status", ["Signed Up","01/08/2026","SU Package","20/09/2026","",""],1,0],
  ["consultation date must not count as signup", ["Signed Up","20/09/2026","","","",""],0,1],
  ["trial status date must not count as signup", ["Signed Up","01/08/2026","Trial FU","20/09/2026","",""],0,1],
  ["unqualified home service date must not count", ["Signed Up","01/08/2026","","","","20/09/2026"],0,1],
  ["August signup excluded from September", ["Signed Up","01/08/2026","SU Package","20/08/2026","",""],0,0],
];
for (const [label,row,total,missing] of examples) {
  api.resetCsoCache();
  const loader = async () => [[headers], [headers,row]];
  const {cso,warning} = await api.loadCsoSafelyForTest("2026-09-01","2026-09-30",loader);
  assert.equal(cso.signedUp,total,label);
  assert.equal(cso.signedUpDateMissing,missing,label);
  assert.equal(Boolean(warning),Boolean(missing),label);
  console.log("PASS:",label);
}
