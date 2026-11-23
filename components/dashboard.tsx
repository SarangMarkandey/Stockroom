"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, CircleAlert, IndianRupee, Package, Plus, ShoppingCart, Warehouse } from "lucide-react";
import { useState } from "react";
import { dayKey, money, number, shortDate } from "../lib/format";
import { balanceKey, movementLabels, orderTotal, stockStatus, type Movement, type MovementKind } from "../lib/inventory";
import { Badge, CardHeading, Empty, GodownFilter, Heading, Metric, MovementTable, Select, productPath, useWorkspace } from "./ui";

function Trend({ movements, anchor }: { movements: Movement[]; anchor: string }) {
  const [period, setPeriod] = useState("7");
  const anchorDay = dayKey(anchor);
  const values = Array.from({ length: Number(period) }, (_, index) => {
    const day = new Date(`${anchorDay}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - Number(period) + index + 1);
    return { day: day.toISOString(), incoming: 0, outgoing: 0 };
  });
  const valuesByDay = new Map(values.map((value) => [dayKey(value.day), value]));
  for (const movement of movements) {
    const value = valuesByDay.get(dayKey(movement.at));
    if (!value) continue;
    if (movement.quantity > 0) value.incoming += movement.quantity;
    else value.outgoing += -movement.quantity;
  }
  const largest = Math.max(4, ...values.flatMap(({ incoming, outgoing }) => [incoming, outgoing]));
  const expectedStep = largest / 4;
  const magnitude = 10 ** Math.floor(Math.log10(expectedStep));
  const step = Math.ceil(expectedStep / magnitude) * magnitude;
  const max = step * 4;
  const ticks = [4, 3, 2, 1, 0].map((index) => index * step);

  return <section className="card trend-card">
    <CardHeading title="Stock activity" description="Units moved in and out of inventory" actions={
      <Select aria-label="Activity date range" value={period} onChange={(event) => setPeriod(event.target.value)} icon={<CalendarDays size={15} />}>
        <option value="7">Last 7 days</option><option value="14">Last 14 days</option>
      </Select>
    } />
    <div className="chart-legend"><span><i />Stock in</span><span><i />Stock out</span></div>
    <div className="chart" role="img" aria-label={`Stock activity from ${shortDate(values[0].day)} to ${shortDate(anchor)}. ${values.map((value) => `${shortDate(value.day)}: ${value.incoming} in, ${value.outgoing} out`).join(". ")}`}>
      <div className="chart-axis" aria-hidden="true">{ticks.map((tick) => <span key={tick}>{number(tick)}</span>)}</div>
      <div className="chart-main" aria-hidden="true">
        <div className="chart-lines">{ticks.map((tick) => <i key={tick} />)}</div>
        <div className="chart-bars">
          {values.map((value, index) => <div key={value.day} className="chart-group">
            <div className="bar-pair" title={`${shortDate(value.day)} · ${value.incoming} in / ${value.outgoing} out`}>
              <i style={{ height: `${value.incoming / max * 100}%` }} />
              <i style={{ height: `${value.outgoing / max * 100}%` }} />
            </div>
            <span>{Number(period) === 7 || index % 2 === 1 ? shortDate(value.day) : ""}</span>
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}

export function Dashboard() {
  const { inventory, ledger } = useWorkspace();
  const [godownId, setGodownId] = useState("");
  const [activity, setActivity] = useState("");
  const [visible, setVisible] = useState(5);
  const godowns = inventory.godowns.filter((godown) => !godownId || godown.id === godownId);
  const orders = inventory.orders.filter((order) => !godownId || order.godownId === godownId);
  const pending = orders.filter((order) => order.kind === "purchase" && !order.postedAt);
  const sales = orders.filter((order) => order.kind === "sale" && order.postedAt);
  const movements = ledger.history.filter((movement) => !godownId || movement.godownId === godownId);
  const activityRows = movements.filter((movement) => !activity || movement.kind === activity).reverse();
  const productCount = godownId ? inventory.products.filter((product) => ledger.balances.has(balanceKey(product.id, godownId))).length : inventory.products.length;
  const alerts = godowns.flatMap((godown) => inventory.products.flatMap((product) => {
    const quantity = ledger.balances.get(balanceKey(product.id, godown.id));
    const status = stockStatus(quantity, product.minimum);
    return status === "Low stock" || status === "Out of stock" ? [{ godown, product, quantity, status }] : [];
  })).sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0));
  const anchor = inventory.movements.at(-1)?.at ?? new Date().toISOString();

  return <>
    <Heading title="Dashboard" description="Monitor inventory levels, orders, and stock activity across your godowns." actions={<>
      <GodownFilter value={godownId} onChange={setGodownId} />
      <details className="action-menu">
        <summary className="button primary"><Plus size={17} /> New order <ChevronDown size={14} /></summary>
        <div className="menu-panel">
          <Link href={`/purchases/new${godownId ? `/${godownId}` : ""}`}><ArrowDownLeft size={16} />New purchase</Link>
          <Link href={`/sales/new${godownId ? `/${godownId}` : ""}`}><ArrowUpRight size={16} />New sale</Link>
        </div>
      </details>
    </>} />
    <div className="metrics-grid">
      <Metric label="Total products" value={number(productCount)} note={godownId ? "Products with stock history" : "Across the product catalog"} icon={<Package size={20} />} />
      <Metric label="Godowns" value={number(godowns.length)} note="Inventory locations" icon={<Warehouse size={20} />} tone="blue" />
      <Metric label="Pending purchases" value={number(pending.length)} note="Orders awaiting receipt" icon={<ShoppingCart size={19} />} tone="amber" />
      <Metric label="Completed sales" value={money(sales.reduce((sum, order) => sum + orderTotal(order.lines), 0))} note={`From ${sales.length} completed ${sales.length === 1 ? "order" : "orders"}`} icon={<IndianRupee size={19} />} tone="green" />
    </div>
    <div className="dashboard-grid">
      <Trend movements={movements} anchor={anchor} />
      <section className="card alert-card">
        <CardHeading title="Stock alerts" description="Products that need attention" actions={<span className="alert-count">{alerts.length}</span>} />
        {alerts.length ? <ul className="alert-list">
          {alerts.map(({ godown, product, status }) => <li key={balanceKey(product.id, godown.id)}>
            <Link href={productPath(product.id, godown.id)}>
              <span className={`movement-icon ${status === "Out of stock" ? "rose" : "amber"}`}><CircleAlert size={17} /></span>
              <span className="alert-name"><strong>{product.name}</strong><small>{godown.name}</small></span>
              <Badge>{status}</Badge><ArrowRight className="alert-arrow" size={15} />
            </Link>
          </li>)}
        </ul> : <Empty title="No stock alerts" description="Tracked products are above their minimum levels." />}
      </section>
    </div>
    <section className="card">
      <CardHeading title="Recent movements" description="Latest stock transactions across your inventory" actions={
        <Select aria-label="Activity type" value={activity} onChange={(event) => { setActivity(event.target.value); setVisible(5); }}>
          <option value="">All activity</option>
          {(Object.keys(movementLabels) as MovementKind[]).map((kind) => <option key={kind} value={kind}>{movementLabels[kind]}</option>)}
        </Select>
      } />
      <MovementTable rows={activityRows.slice(0, visible)} />
      {activityRows.length > visible && <div className="table-footer"><button type="button" className="button secondary" onClick={() => setVisible(visible + 10)}>Show more movements</button></div>}
    </section>
  </>;
}
