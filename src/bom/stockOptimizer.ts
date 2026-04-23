import type { StockPlan, StrutGroup, ValidationMessage } from "../types";

export const optimizeStock = (
  groups: StrutGroup[],
  stockLengthM: number | null,
  sawKerfM = 0.002,
  minimumReusableOffcutM = 0.35
): { plan: StockPlan; warnings: ValidationMessage[] } => {
  const warnings: ValidationMessage[] = [];
  const cuts = groups.flatMap((group) => Array.from({ length: group.quantity }, () => group.cutLengthM));
  const largest = Math.max(0, ...cuts);

  if (stockLengthM === null || !Number.isFinite(stockLengthM)) {
    return {
      plan: {
        stockLengthM: null,
        barCount: null,
        usedLengthM: cuts.reduce((sum, cut) => sum + cut, 0),
        scrapLengthM: null,
        reusableOffcutsM: [],
        yieldPercent: null
      },
      warnings
    };
  }

  if (stockLengthM <= largest) {
    warnings.push({
      level: "error",
      code: "stock-too-short",
      message: "Stock length must exceed the largest cut length."
    });
  }

  const bars: number[] = [];
  const sorted = [...cuts].sort((a, b) => b - a);

  sorted.forEach((cut) => {
    const required = cut + sawKerfM;
    let placed = false;
    for (let i = 0; i < bars.length; i += 1) {
      if (bars[i] + required <= stockLengthM) {
        bars[i] += required;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bars.push(required);
    }
  });

  const usedLengthM = cuts.reduce((sum, cut) => sum + cut, 0);
  const purchasedLengthM = bars.length * stockLengthM;
  const scrapLengthM = Math.max(0, purchasedLengthM - bars.reduce((sum, used) => sum + used, 0));
  const reusableOffcutsM = bars
    .map((used) => stockLengthM - used)
    .filter((offcut) => offcut >= minimumReusableOffcutM)
    .sort((a, b) => b - a);

  const plan: StockPlan = {
    stockLengthM,
    barCount: bars.length,
    usedLengthM,
    scrapLengthM,
    reusableOffcutsM,
    yieldPercent: purchasedLengthM > 0 ? (usedLengthM / purchasedLengthM) * 100 : 0
  };

  if (plan.yieldPercent !== null && plan.yieldPercent > 0 && plan.yieldPercent < 70) {
    warnings.push({
      level: "warning",
      code: "high-stock-scrap",
      message: "Selected stock length produces high scrap. Try a different stock length or grouping tolerance."
    });
  }

  return { plan, warnings };
};
