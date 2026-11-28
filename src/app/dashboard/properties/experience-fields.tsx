"use client";
import { useState, type ReactNode } from "react";
import { F } from "./property-sections";

// Appointed date + "any past experience?" (Yes shows years / months). Read on the server by parseExperience().
export default function ExperienceFields({ appointedAt, pastMonths, fe }: { appointedAt?: string | null; pastMonths?: number | null; fe: (k: string) => ReactNode }) {
  const [past, setPast] = useState(!!pastMonths);
  return (
    <>
      <F label="Appointed date"><input className="field" name="appointedAt" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={appointedAt ?? ""} />{fe("appointedAt")}</F>
      <F label="Any past experience?">
        <select className="field" name="hasPastExp" value={past ? "yes" : "no"} onChange={(e) => setPast(e.target.value === "yes")}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </F>
      {past && (
        <div className="grid grid-cols-2 gap-4 sm:col-span-2">
          <F label="Past experience: years"><input className="field" name="expYears" type="number" inputMode="numeric" min={0} max={60} defaultValue={pastMonths ? Math.floor(pastMonths / 12) : ""} placeholder="e.g. 2" /></F>
          <F label="Months"><input className="field" name="expMonths" type="number" inputMode="numeric" min={0} max={11} defaultValue={pastMonths ? pastMonths % 12 : ""} placeholder="e.g. 6" /></F>
          <div className="col-span-2">{fe("pastExp")}</div>
        </div>
      )}
    </>
  );
}
