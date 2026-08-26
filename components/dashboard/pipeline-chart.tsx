"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STAGE_CONFIG, type PipelineStage } from "@/lib/constants";

const STAGE_FILL: Record<PipelineStage, string> = {
  NEW_LEAD: "oklch(0.7 0.02 275)",
  CONTACTED: "var(--chart-2)",
  INTERESTED: "var(--chart-1)",
  MEETING: "var(--chart-4)",
  PROPOSAL: "oklch(0.72 0.15 55)",
  WON: "var(--chart-3)",
  LOST: "oklch(0.65 0.12 20)",
};

export function PipelineChart({
  data,
}: {
  data: { stage: PipelineStage; count: number }[];
}) {
  const rows = data.map((d) => ({
    ...d,
    name: STAGE_CONFIG[d.stage].label,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
        >
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={78}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              fontSize: 12,
              boxShadow: "0 8px 30px rgb(0 0 0 / 0.08)",
            }}
          />
          <Bar dataKey="count" name="Prospects" radius={[4, 6, 6, 4]} barSize={18}>
            {rows.map((row) => (
              <Cell key={row.stage} fill={STAGE_FILL[row.stage]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
