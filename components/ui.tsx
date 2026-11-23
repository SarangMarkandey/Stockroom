"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowRightLeft, ArrowUpRight, ChevronDown, CircleAlert, Package, Search, Warehouse } from "lucide-react";
import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode, type SelectHTMLAttributes } from "react";
import { clock, date, number, shortDate, signed } from "../lib/format";
import { balanceKey, movementLabels, readLedger } from "../lib/inventory";
import { updateInventory, useInventory } from "../lib/store";

export function useWorkspace() {
  const inventory = useInventory();
  const ledger = useMemo(() => readLedger(inventory.movements), [inventory.movements]);
  const products = useMemo(() => new Map(inventory.products.map((product) => [product.id, product])), [inventory.products]);
  const godowns = useMemo(() => new Map(inventory.godowns.map((godown) => [godown.id, godown])), [inventory.godowns]);
  return { inventory, ledger, products, godowns };
}

export const ToastContext = createContext<(message: string) => void>(() => {});

export function useSave() {
  const notify = useContext(ToastContext);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(update: Parameters<typeof updateInventory>[0], message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await updateInventory(update);
      notify(message);
      return result;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The change could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return { error, busy, save };
}

export function Heading({ title, description, actions, back }: {
  title: string; description?: string; actions?: ReactNode; back?: { href: string; label: string };
}) {
  return <>
    {back && <BackLink {...back} />}
    <div className="page-heading">
      <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  </>;
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="back-link"><ArrowLeft size={16} />{label}</Link>;
}

export function CardHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="card-heading">
    <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
    {actions && <div className="actions">{actions}</div>}
  </div>;
}

export function Metric({ label, value, note, icon, tone = "indigo" }: {
  label: string; value: ReactNode; note: string; icon: ReactNode; tone?: string;
}) {
  return <div className="card metric">
    <span className={`icon-tile ${tone}`}>{icon}</span>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
    <p>{note}</p>
  </div>;
}

const tones: Record<string, string> = {
  "In stock": "green", "Low stock": "amber", "Out of stock": "red", "No history": "neutral",
  "Completed": "green", "Received": "green", "Pending": "amber", "Draft": "neutral",
  "Stock In": "green", "Stock Out": "indigo", "Transfer": "blue", "Opening stock": "neutral",
};

export function Badge({ children }: { children: string }) {
  return <span className={`badge ${tones[children] ?? "neutral"}`}><span />{children}</span>;
}

export function Empty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="empty">
    <span className="icon-tile indigo"><Package size={21} /></span>
    <h3>{title}</h3>{description && <p>{description}</p>}{action}
  </div>;
}

export function SearchBox({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <label className="search">
    <Search size={17} aria-hidden="true" />
    <input type="search" aria-label={label} placeholder={label} value={value} onChange={(event) => onChange(event.target.value)} />
  </label>;
}

export function Select({ children, icon, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { icon?: ReactNode }) {
  return <span className={`select-wrap${icon ? " with-icon" : ""}`}>
    {icon && <span className="select-icon">{icon}</span>}
    <select {...props}>{children}</select><ChevronDown aria-hidden="true" size={14} />
  </span>;
}

export function GodownFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inventory = useInventory();
  return <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Godown filter" icon={<Warehouse size={16} />}>
    <option value="">All Godowns</option>
    {inventory.godowns.map((godown) => <option key={godown.id} value={godown.id}>{godown.name}</option>)}
  </Select>;
}

export function StatusFilter({ value, onChange, statuses }: { value: string; onChange: (value: string) => void; statuses: string[] }) {
  return <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Status filter">
    <option value="">All statuses</option>
    {statuses.map((status) => <option key={status}>{status}</option>)}
  </Select>;
}

export function matches(query: string, ...values: string[]) {
  return values.some((value) => value.toLowerCase().includes(query.trim().toLowerCase()));
}

export function Table({ headers, children, label }: { headers: string[]; children: ReactNode; label: string }) {
  return <div className="table-wrap" tabIndex={0} role="region" aria-label={label}>
    <table aria-label={label}><thead><tr>{headers.map((header, index) => <th scope="col" key={index}>
      {header || <span className="sr-only">Details</span>}
    </th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function ErrorMessage({ error }: { error: string }) {
  return error ? <p role="alert" className="form-error"><CircleAlert size={17} />{error}</p> : null;
}

export function EntryForm({ children, error, busy, label, cancel, onSubmit }: {
  children: ReactNode; error: string; busy: boolean; label: string; cancel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <form className="card entry-form" onSubmit={onSubmit}>
    <div className="form-body">{children}<ErrorMessage error={error} /></div>
    <div className="form-footer">
      <Link className="button secondary" href={cancel}>Cancel</Link>
      <button className="button primary" disabled={busy} type="submit">{busy ? "Saving…" : label}</button>
    </div>
  </form>;
}

export function orderPath(kind: "sale" | "purchase", id: string) {
  return `/${kind === "sale" ? "sales" : "purchases"}/${id}`;
}

export function productPath(productId: string, godownId?: string) {
  return godownId ? `/stock/${productId}/${godownId}` : `/stock/${productId}`;
}

type LedgerMovement = ReturnType<typeof readLedger>["history"][number];

export function Reference({ movement }: { movement: LedgerMovement }) {
  const { kind, reference } = movement;
  const path = kind === "opening" ? `/stock/opening/${reference}`
    : kind === "transfer" ? `/godowns/transfers/${reference}` : orderPath(kind, reference);
  return <Link className="reference" href={path}>{reference}</Link>;
}

export function Quantity({ value }: { value: number }) {
  return <span className={`quantity ${value > 0 ? "incoming" : "outgoing"}`}>{signed(value)}</span>;
}

function MovementIcon({ kind }: { kind: LedgerMovement["kind"] }) {
  if (kind === "transfer") return <span className="movement-icon blue"><ArrowRightLeft size={16} /></span>;
  if (kind === "sale") return <span className="movement-icon rose"><ArrowUpRight size={17} /></span>;
  return <span className="movement-icon green"><ArrowDownLeft size={18} /></span>;
}

export function MovementTable({ rows, detailed = false }: { rows: LedgerMovement[]; detailed?: boolean }) {
  const { products, godowns } = useWorkspace();
  if (!rows.length) return <Empty title="No stock movements" description="Movements appear here when stock is recorded." />;
  const headers = detailed
    ? ["Date", "Godown", "Movement", "Quantity", "Before", "After", "Reference"]
    : ["Product", "Godown", "Movement", "Quantity", "Reference", "Date"];
  return <Table headers={headers} label="Stock movements">
    {rows.map((movement) => <tr key={`${movement.reference}-${balanceKey(movement.productId, movement.godownId)}`}>
      {!detailed && <td><Link className="cell-link" href={productPath(movement.productId, movement.godownId)}>{products.get(movement.productId)?.name}</Link></td>}
      {detailed && <td>{date(movement.at)}</td>}
      <td>{godowns.get(movement.godownId)?.name}</td>
      <td><Badge>{movementLabels[movement.kind]}</Badge></td>
      <td><Quantity value={movement.quantity} /></td>
      {detailed && <><td className="numeric">{number(movement.before)}</td><td className="numeric">{number(movement.after)}</td></>}
      <td><Reference movement={movement} /></td>
      {!detailed && <td>{date(movement.at)}</td>}
    </tr>)}
  </Table>;
}

export function MovementList({ rows }: { rows: LedgerMovement[] }) {
  const { products } = useWorkspace();
  if (!rows.length) return <Empty title="No recent movements" description="Stock In, Stock Out, and transfers will appear here." />;
  return <ul className="movement-list">
    {rows.map((movement) => <li key={`${movement.reference}-${movement.productId}-${movement.godownId}`}>
      <MovementIcon kind={movement.kind} />
      <div className="movement-copy">
        <Link className="cell-link" href={productPath(movement.productId, movement.godownId)}>{products.get(movement.productId)?.name}</Link>
        <span>{movementLabels[movement.kind]} <span aria-hidden="true">·</span> <Reference movement={movement} /></span>
      </div>
      <div className="movement-value"><Quantity value={movement.quantity} /><small title={date(movement.at)}>{shortDate(movement.at)} · {clock(movement.at)}</small></div>
    </li>)}
  </ul>;
}
