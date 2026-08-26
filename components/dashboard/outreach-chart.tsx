"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OutreachPoint } from "@/lib/metrics";

export function OutreachChart({ data }: { data: OutreachPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="fill-sent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fill-replied" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            interval={6}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              fontSize: 12,
              boxShadow: "0 8px 30px rgb(0 0 0 / 0.08)",
            }}
          />
          <Area
            type="monotone"
            dataKey="sent"
            name="Sent"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#fill-sent)"
          />
          <Area
            type="monotone"
            dataKey="opened"
            name="Opened"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="transparent"
          />
          <Area
            type="monotone"
            dataKey="replied"
            name="Replied"
            stroke="var(--chart-3)"
            strokeWidth={2}
            fill="url(#fill-replied)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
