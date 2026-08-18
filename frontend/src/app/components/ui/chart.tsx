"use client";

import * as React from "react";
import { cn } from "./utils";

// 说明：原模板组件依赖 recharts；当前项目未实际使用该图表组件。
// 为消除 recharts -> lodash 的安全审计风险，这里保留兼容导出，避免未来误引用时报错。
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  id?: string;
  config: ChartConfig;
  children?: React.ReactNode;
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 text-sm text-muted-foreground",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {children || "图表组件未启用"}
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, itemConfig]) => itemConfig.theme || itemConfig.color,
  );

  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join("\n")}
}
`,)
          .join("\n"),
      }}
    />
  );
};

function ChartTooltip({ children }: { children?: React.ReactNode }) {
  return <>{children || null}</>;
}

function ChartTooltipContent({ className, children }: React.ComponentProps<"div">) {
  useChart();
  return (
    <div className={cn("rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl", className)}>
      {children || "暂无图表提示"}
    </div>
  );
}

function ChartLegend({ children }: { children?: React.ReactNode }) {
  return <>{children || null}</>;
}

function ChartLegendContent({ className, children }: React.ComponentProps<"div">) {
  useChart();
  return <div className={cn("flex items-center justify-center gap-4", className)}>{children}</div>;
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};
