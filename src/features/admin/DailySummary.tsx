import { Card } from "../../components/ui/Card";
import type { OrderDoc, StockDoc } from "../../types/firestore";
import { formatTHB } from "../../utils/money";

interface DailySummaryProps {
  orders: Array<OrderDoc & { id: string }>;
  stock: StockDoc;
}

export function DailySummary({ orders, stock }: DailySummaryProps): JSX.Element {
  const validOrders = orders.filter((order) => order.status !== "cancelled");
  const revenue = validOrders.reduce((sum, order) => sum + order.calculated.total, 0);
  const regularSold = validOrders.reduce((sum, order) => sum + order.quantities.regular, 0);
  const smallSold = validOrders.reduce((sum, order) => sum + order.quantities.small, 0);
  const sauceSold = validOrders.reduce((sum, order) => sum + order.quantities.extraSauce, 0);
  const openerSold = validOrders.reduce((sum, order) => sum + order.quantities.opener, 0);
  const hoiUsed = validOrders.reduce((sum, order) => sum + order.calculated.hoiGramsDeducted, 0);

  const statusCount = validOrders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card title="Daily summary">
      <div className="grid gap-1 text-sm">
        <p>Orders today: {orders.length}</p>
        <p>Revenue today: {formatTHB(revenue)} THB</p>
        <p>Regular sold: {regularSold}</p>
        <p>Small sold: {smallSold}</p>
        <p>Extra sauce sold: {sauceSold}</p>
        <p>Openers sold: {openerSold}</p>
        <p>Hoi grams used: {hoiUsed}</p>
        <p>Hoi kg remaining: {(stock.availableHoiGrams / 1000).toFixed(1)}</p>
        <p>Orders by status: {JSON.stringify(statusCount)}</p>
      </div>
    </Card>
  );
}
