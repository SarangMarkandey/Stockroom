"use client";

import Link from "next/link";
import { CircleAlert, ClipboardList, IndianRupee, Layers3 } from "lucide-react";
import { useState } from "react";
import { dayKey, money, number } from "../lib/format";
import { balanceKey, orderTotal, stockStatus } from "../lib/inventory";
import { OrderTable } from "./orders";
import { Badge, CardHeading, Empty, Field, GodownFilter, Heading, Metric, StatusFilter, Table, productPath, useWorkspace } from "./ui";

type Report = "stock" | "sales" | "purchases";
const tabs = [
  { id: "stock", label: "Stock", href: "/reports" },
  { id: "sales", label: "Sales", href: "/reports/sales" },
  { id: "purchases", label: "Purchases", href: "/reports/purchases" },
] as const;
const statuses = ["In stock", "Low stock", "Out of stock"];

export function Reports({ report }: { report: Report }) {
  return <>
    <Heading title="Reports" description="Review stock balances, completed sales, and received purchases." />
    <nav className="report-tabs" aria-label="Report type">
      {tabs.map(({ id, href, label }) => <Link key={id} href={href} aria-current={report === id ? "page" : undefined}>{label}</Link>)}
    </nav>
    {report === "stock" ? <StockReport /> : <OrderReport key={report} kind={report === "sales" ? "sale" : "purchase"} />}
  </>;
}

function StockReport() {
  const { inventory, ledger } = useWorkspace();
  const [godownId, setGodownId] = useState("");
  const [status, setStatus] = useState("");
  const rows = inventory.godowns.filter((godown) => !godownId || godown.id === godownId).flatMap((godown) =>
    inventory.products.flatMap((product) => {
      const onHand = ledger.balances.get(balanceKey(product.id, godown.id));
      if (onHand === undefined) return [];
      const stock = stockStatus(onHand, product.minimum);
      return !status || status === stock ? [{ godown, product, onHand, stock }] : [];
    })
  );

  return <>
    <div className="report-filters">
      <GodownFilter value={godownId} onChange={setGodownId} />
      <StatusFilter value={status} onChange={setStatus} statuses={statuses} />
    </div>
    <div className="report-metrics">
      <Metric label="Product locations" value={number(rows.length)} note="Product and godown balances" icon={<ClipboardList size={19} />} />
      <Metric label="Units on hand" value={number(rows.reduce((sum, row) => sum + row.onHand, 0))} note="Across filtered balances" icon={<Layers3 size={19} />} tone="blue" />
      <Metric label="Stock alerts" value={number(rows.filter((row) => row.stock !== "In stock").length)} note="Low or out of stock" icon={<CircleAlert size={19} />} tone="amber" />
    </div>
    <section className="card">
      <CardHeading title="Stock balances" />
      {rows.length ? <Table label="Stock balances" headers={["Product code", "Product", "Godown", "Unit", "On hand", "Minimum", "Status"]}>
        {rows.map(({ godown, product, onHand, stock }) => <tr key={balanceKey(product.id, godown.id)}>
          <td><span className="product-code">{product.code}</span></td>
          <td><Link className="cell-link" href={productPath(product.id, godown.id)}>{product.name}</Link></td>
          <td>{godown.name}</td><td>{product.unit}</td><td className="numeric">{number(onHand)}</td><td className="numeric">{number(product.minimum)}</td><td><Badge>{stock}</Badge></td>
        </tr>)}
      </Table> : <Empty title="No matching balances" description="Change the godown or stock status filter." />}
    </section>
  </>;
}

function OrderReport({ kind }: { kind: "sale" | "purchase" }) {
  const { inventory } = useWorkspace();
  const [godownId, setGodownId] = useState("");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const sales = kind === "sale";
  const invalid = Boolean(from && through && from > through);
  const rows = inventory.orders.filter((order) => {
    if (invalid || order.kind !== kind || !order.postedAt || (godownId && order.godownId !== godownId)) return false;
    const postedDay = dayKey(order.postedAt);
    return (!from || postedDay >= from) && (!through || postedDay <= through);
  }).sort((a, b) => Date.parse(b.postedAt!) - Date.parse(a.postedAt!));

  return <>
    <div className="report-filters">
      <GodownFilter value={godownId} onChange={setGodownId} />
      <Field label={sales ? "Completed from" : "Received from"}><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
      <Field label="Through"><input type="date" value={through} onChange={(event) => setThrough(event.target.value)} /></Field>
      {(from || through || godownId) && <button className="button secondary" onClick={() => { setGodownId(""); setFrom(""); setThrough(""); }}>Clear filters</button>}
    </div>
    {invalid && <p className="form-error" role="alert">Choose an end date on or after the start date.</p>}
    <div className="report-metrics">
      <Metric label={sales ? "Completed orders" : "Received orders"} value={number(rows.length)} note="Orders in this report" icon={<ClipboardList size={19} />} />
      <Metric label={sales ? "Sales value" : "Purchase value"} value={money(rows.reduce((sum, row) => sum + orderTotal(row.lines), 0))} note="Total for filtered orders" icon={<IndianRupee size={19} />} tone="green" />
    </div>
    <section className="card"><CardHeading title={sales ? "Completed sales" : "Received purchases"} /><OrderTable kind={kind} rows={rows} postedOnly /></section>
  </>;
}
