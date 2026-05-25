import { useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import type { Translation } from "../../i18n";
import type { OrderDoc, StockDoc } from "../../types/firestore";
import { toDateOrNull } from "../../utils/dates";
import { formatTHB } from "../../utils/money";

interface DailySummaryProps {
  orders: Array<OrderDoc & { id: string }>;
  stock: StockDoc;
  t: Translation;
}

export function DailySummary({ orders, stock, t }: DailySummaryProps): JSX.Element {
  const [range, setRange] = useState<"day" | "week" | "month">("day");
  const periodStart = useMemo(() => {
    const now = new Date();
    const base = new Date(now);
    if (range === "day") {
      base.setHours(0, 0, 0, 0);
      return base;
    }
    if (range === "week") {
      base.setDate(base.getDate() - 6);
      base.setHours(0, 0, 0, 0);
      return base;
    }
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    return base;
  }, [range]);

  const inRangeOrders = orders.filter((order) => {
    const createdDate = toDateOrNull(order.createdAt);
    if (!createdDate) {
      return false;
    }
    return createdDate >= periodStart && order.archivedAt === undefined;
  });
  const validOrders = inRangeOrders.filter((order) => order.status !== "cancelled");
  const revenue = validOrders.reduce((sum, order) => sum + order.calculated.total, 0);
  const regularSold = validOrders.reduce(
    (sum, order) =>
      sum +
      order.itemSnapshot
        .filter((item) => item.productId === "regular")
        .reduce((acc, item) => acc + item.quantity, 0),
    0,
  );
  const smallSold = validOrders.reduce(
    (sum, order) =>
      sum +
      order.itemSnapshot
        .filter((item) => item.productId === "small")
        .reduce((acc, item) => acc + item.quantity, 0),
    0,
  );
  const sauceSold = validOrders.reduce(
    (sum, order) =>
      sum +
      order.itemSnapshot
        .filter((item) => item.category === "sauce")
        .reduce((acc, item) => acc + item.quantity, 0),
    0,
  );
  const openerSold = validOrders.reduce(
    (sum, order) =>
      sum +
      order.itemSnapshot
        .filter((item) => item.stockType === "opener")
        .reduce((acc, item) => acc + item.quantity, 0),
    0,
  );
  const hoiUsed = validOrders.reduce((sum, order) => sum + order.calculated.hoiGramsDeducted, 0);

  const statusCount = validOrders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card title={t.adminDailySummaryTitle}>
      <div className="mb-3 flex gap-2">
        <Button variant={range === "day" ? "primary" : "secondary"} onClick={() => setRange("day")}>
          {t.statsRangeDay}
        </Button>
        <Button variant={range === "week" ? "primary" : "secondary"} onClick={() => setRange("week")}>
          {t.statsRangeWeek}
        </Button>
        <Button variant={range === "month" ? "primary" : "secondary"} onClick={() => setRange("month")}>
          {t.statsRangeMonth}
        </Button>
      </div>
      <div className="grid gap-1 text-sm">
        <p>{t.ordersTodayLabel}: {inRangeOrders.length}</p>
        <p>{t.revenueTodayLabel}: {formatTHB(revenue)} THB</p>
        <p>{t.regularSoldLabel}: {regularSold}</p>
        <p>{t.smallSoldLabel}: {smallSold}</p>
        <p>{t.extraSauceSoldLabel}: {sauceSold}</p>
        <p>{t.openersSoldLabel}: {openerSold}</p>
        <p>{t.hoiGramsUsedLabel}: {hoiUsed}</p>
        <p>{t.hoiKgRemainingLabel}: {(stock.availableHoiGrams / 1000).toFixed(1)}</p>
        <p>{t.ordersByStatusLabel}: {JSON.stringify(statusCount)}</p>
      </div>
    </Card>
  );
}
