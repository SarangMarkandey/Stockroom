"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { date, money, number, parsePaise, parseQuantity } from "../lib/format";
import { balanceKey, createOrder, orderStatus, orderTotal, postOrder, type Order, type OrderKind } from "../lib/inventory";
import { Missing } from "./locations";
import { Badge, CardHeading, Empty, EntryForm, ErrorMessage, Field, GodownFilter, Heading, SearchBox, Select, StatusFilter, Table, matches, orderPath, productPath, useSave, useWorkspace } from "./ui";

const config = {
  sale: {
    title: "Sales", entity: "sale", partner: "Customer", example: "e.g. Maple Desk Co.", location: "Dispatch godown", base: "/sales",
    statuses: ["Draft", "Completed"], description: "Create sales orders and dispatch stock from your godowns.",
    name: "New sale", create: "Save draft", amount: "Unit price", post: "Complete sale",
    notice: "Stock is deducted from the dispatch godown when you complete this sale.",
    saved: "Sales draft created.", posted: "Sale completed. Stock deducted.",
  },
  purchase: {
    title: "Purchases", entity: "purchase", partner: "Supplier", example: "e.g. Sundaram Paper Traders", location: "Receiving godown", base: "/purchases",
    statuses: ["Pending", "Received"], description: "Manage purchase orders and receive stock into your godowns.",
    name: "New purchase", create: "Create purchase order", amount: "Unit cost", post: "Mark received",
    notice: "Stock is added to the receiving godown when you mark this purchase received.",
    saved: "Pending purchase created.", posted: "Purchase received. Stock added.",
  },
};

export function Orders({ kind }: { kind: OrderKind }) {
  const settings = config[kind];
  const { inventory } = useWorkspace();
  const [query, setQuery] = useState("");
  const [godown, setGodown] = useState("");
  const [status, setStatus] = useState("");
  const rows = inventory.orders.filter((order) =>
    order.kind === kind && (!godown || godown === order.godownId) && (!status || status === orderStatus(order))
    && matches(query, order.id, order.partner)
  ).reverse();
  return <>
    <Heading title={settings.title} description={settings.description} actions={<Link className="button primary" href={`${settings.base}/new${godown ? `/${godown}` : ""}`}><Plus size={17} />{settings.name}</Link>} />
    <section className="card">
      <CardHeading title={kind === "sale" ? "Sales orders" : "Purchase orders"} description={`${rows.length} ${rows.length === 1 ? "order" : "orders"}`} />
      <div className="filters">
        <SearchBox value={query} onChange={setQuery} label={`Search by order or ${settings.partner.toLowerCase()}`} />
        <GodownFilter value={godown} onChange={setGodown} />
        <StatusFilter value={status} onChange={setStatus} statuses={settings.statuses} />
      </div>
      <OrderTable kind={kind} rows={rows} />
    </section>
  </>;
}

export function OrderTable({ kind, rows, postedOnly = false }: { kind: OrderKind; rows: Order[]; postedOnly?: boolean }) {
  const { godowns } = useWorkspace();
  const settings = config[kind];
  const dateLabel = postedOnly ? (kind === "sale" ? "Completion date" : "Receipt date") : "Order date";
  if (!rows.length) return <Empty title="No matching orders" description="Try another search or change the filters." />;
  return <Table label={settings.title} headers={["Order number", settings.partner, settings.location, dateLabel, "Amount", "Status", ""]}>
    {rows.map((order) => <tr key={order.id}>
      <td><Link href={orderPath(kind, order.id)} className="reference">{order.id}</Link></td>
      <td className="strong">{order.partner}</td><td>{godowns.get(order.godownId)?.name}</td>
      <td>{date(postedOnly ? order.postedAt! : order.createdAt)}</td>
      <td className="numeric">{money(orderTotal(order.lines))}</td><td><Badge>{orderStatus(order)}</Badge></td>
      <td><Link className="row-link" aria-label={`View ${order.id}`} href={orderPath(kind, order.id)}><ChevronRight size={17} /></Link></td>
    </tr>)}
  </Table>;
}

type FormLine = { id: number; productId: string; quantity: string; amount: string };
const blankLine = (id: number): FormLine => ({ id, productId: "", quantity: "1", amount: "" });

export function OrderForm({ kind, initialGodown = "" }: { kind: OrderKind; initialGodown?: string }) {
  const settings = config[kind];
  const { inventory, ledger } = useWorkspace();
  const [partner, setPartner] = useState("");
  const [godownId, setGodownId] = useState(initialGodown);
  const [lines, setLines] = useState([blankLine(0)]);
  const [nextLineId, setNextLineId] = useState(1);
  const router = useRouter();
  const { save, busy, error } = useSave();
  const parsed = lines.map(({ productId, quantity, amount }) => ({
    productId,
    quantity: parseQuantity(quantity),
    unitPaise: parsePaise(amount),
  }));
  const displayTotals = parsed.map((line) => line.quantity > 0 && Number.isSafeInteger(line.quantity * line.unitPaise) ? line.quantity * line.unitPaise : 0);
  const total = displayTotals.reduce((sum, amount) => sum + amount, 0);
  function changeLine(id: number, change: Partial<Omit<FormLine, "id">>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...change } : line));
  }
  return <>
    <Heading title={settings.name} description={kind === "sale" ? "Prepare an order for dispatch." : "Create a pending order to receive later."} back={{ href: settings.base, label: settings.title }} />
    <EntryForm cancel={settings.base} error={error} busy={busy} label={settings.create} onSubmit={async (event) => {
      event.preventDefault();
      const result = await save((state) => createOrder(state, { kind, godownId, partner, lines: parsed }), settings.saved);
      if (result) router.push(orderPath(kind, result.orders.at(-1)!.id));
    }}>
      <div className="form-grid">
        <Field label={settings.partner}><input required maxLength={100} value={partner} onChange={(event) => setPartner(event.target.value)} placeholder={settings.example} /></Field>
        <Field label={settings.location}><Select required value={godownId} onChange={(event) => setGodownId(event.target.value)}>
          <option value="">Select a godown</option>
          {inventory.godowns.map((godown) => <option key={godown.id} value={godown.id}>{godown.name}</option>)}
        </Select></Field>
      </div>
      <div className="form-section">
        <div className="form-section-heading"><h2>Order items</h2><button type="button" className="button secondary" onClick={() => {
          setLines([...lines, blankLine(nextLineId)]);
          setNextLineId(nextLineId + 1);
        }}><Plus size={16} />Add line</button></div>
        {lines.map((line, index) => {
          const available = ledger.balances.get(balanceKey(line.productId, godownId)) ?? 0;
          return <fieldset key={line.id} className="order-line">
            <legend className="sr-only">Order line {index + 1}</legend>
            <Field label="Product" hint={kind === "sale" && line.productId ? godownId ? `${number(available)} available at this godown` : "Select a dispatch godown for availability." : undefined}>
              <Select required value={line.productId} onChange={(event) => changeLine(line.id, { productId: event.target.value })}>
                <option value="">Select a product</option>
                {inventory.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.code}</option>)}
              </Select>
            </Field>
            <Field label="Quantity"><input required inputMode="numeric" value={line.quantity} onChange={(event) => changeLine(line.id, { quantity: event.target.value })} /></Field>
            <Field label={`${settings.amount} (₹)`}><input required inputMode="decimal" value={line.amount} onChange={(event) => changeLine(line.id, { amount: event.target.value })} placeholder="0.00" /></Field>
            <div className="line-total"><span>Line total</span><strong>{money(displayTotals[index])}</strong></div>
            <button type="button" className="icon-button" aria-label={`Remove line ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines(lines.filter((item) => item.id !== line.id))}><Trash2 size={17} /></button>
          </fieldset>;
        })}
      </div>
      <div className="order-total"><span>Order total</span><strong>{Number.isSafeInteger(total) ? money(total) : "Amount too large"}</strong></div>
    </EntryForm>
  </>;
}

export function OrderDetail({ id, kind }: { id: string; kind: OrderKind }) {
  const { inventory, products, godowns } = useWorkspace();
  const { save, busy, error } = useSave();
  const order = inventory.orders.find((item) => item.id === id && item.kind === kind);
  const settings = config[kind];
  if (!order) return <Missing label="Order" href={settings.base} />;
  return <>
    <Heading title={order.id} description={`${kind === "sale" ? "Sales" : "Purchase"} order · ${order.partner}`} back={{ href: settings.base, label: settings.title }} actions={<Badge>{orderStatus(order)}</Badge>} />
    <section className="card detail-card">
      <CardHeading title="Order details" />
      <dl className="detail-grid">
        <div><dt>{settings.partner}</dt><dd>{order.partner}</dd></div>
        <div><dt>{settings.location}</dt><dd><Link href={`/godowns/${order.godownId}`}>{godowns.get(order.godownId)?.name}</Link></dd></div>
        <div><dt>Order date</dt><dd>{date(order.createdAt)}</dd></div>
        {order.postedAt && <div><dt>{kind === "sale" ? "Completed on" : "Received on"}</dt><dd>{date(order.postedAt)}</dd></div>}
      </dl>
      <Table label="Order items" headers={["Product", "Product code", "Quantity", settings.amount, "Line total"]}>
        {order.lines.map((line, index) => {
          const product = products.get(line.productId);
          return <tr key={index}>
            <td><Link className="cell-link" href={productPath(line.productId, order.godownId)}>{product?.name}</Link></td>
            <td><span className="product-code">{product?.code}</span></td>
            <td className="numeric">{number(line.quantity)} <span className="muted">{product?.unit}</span></td>
            <td className="numeric">{money(line.unitPaise)}</td><td className="numeric">{money(line.quantity * line.unitPaise)}</td>
          </tr>;
        })}
      </Table>
      <div className="detail-total order-total"><span>Order total</span><strong>{money(orderTotal(order.lines))}</strong></div>
    </section>
    {!order.postedAt && <section className="card section-space posting-card">
      <div className="posting-row">
        <div><h2>{settings.post}</h2><p>{settings.notice}</p></div>
        <button type="button" className="button primary" onClick={() => save((state) => postOrder(state, id), settings.posted)} disabled={busy}>
          {kind === "sale" ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}{busy ? "Saving…" : settings.post}
        </button>
      </div>
      <ErrorMessage error={error} />
    </section>}
  </>;
}
