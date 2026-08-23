"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { WeightHistoryPoint } from '#/lib/exercise-weight-history'

type ExerciseWeightHistoryChartProps = {
  points: WeightHistoryPoint[]
  minReps: number
}

const chartConfig = {
  maxWeight: {
    label: 'Weight',
    color: 'var(--lagoon)',
  },
} satisfies ChartConfig

function formatSessionDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function ExerciseWeightHistoryChart({
  points,
  minReps,
}: ExerciseWeightHistoryChartProps) {
  if (points.length === 0) {
    return (
      <p className="border border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--sea-ink-soft)]">
        No {minReps}-rep max history yet. Log qualifying sets to see progress
        here.
      </p>
    )
  }

  const chartData = points.map((point) => ({
    session: formatSessionDate(point.date),
    maxWeight: Math.round(point.maxWeight),
  }))

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--sea-ink-soft)]">
        Best qualifying set per session ({minReps}+ reps)
      </p>
      <ChartContainer
        config={chartConfig}
        className="h-[220px] w-full [&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-responsive-container]:!h-full"
        initialDimension={{ width: 480, height: 220 }}
      >
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="session"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tick={{ fill: 'var(--foreground)' }}
          />
          <YAxis
            dataKey="maxWeight"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={40}
            tick={{ fill: 'var(--foreground)' }}
            tickFormatter={(value: number) => `${value}`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const entry = payload?.[0]?.payload as
                    | { session?: string }
                    | undefined
                  return entry?.session ?? ''
                }}
                formatter={(value) => [`${value} lb`, 'Max weight']}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="maxWeight"
            stroke="var(--color-maxWeight)"
            strokeWidth={2}
            dot={{ fill: 'var(--color-maxWeight)', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}
