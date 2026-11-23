"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, PackagePlus, Plus } from "lucide-react";
import { useState } from "react";
import { date, number, parseQuantity } from "../lib/format";
import { addProduct, balanceKey, recordOpening, stockStatus, type Product, type StockStatus } from "../lib/inventory";
import { Missing } from "./locations";
import { Badge, CardHeading, Empty, EntryForm, Field, GodownFilter, Heading, MovementTable, SearchBox, Select, StatusFilter, Table, matches, productPath, useSave, useWorkspace } from "./ui";

export const stockStatuses: StockStatus[] = ["In stock", "Low stock", "Out of stock", "No history"];

export function Stock() {
  const { inventory, ledger } = useWorkspace();
  const [query, setQuery] = useState("");
  const [godown, setGodown] = useState("");
  const [status, setStatus] = useState("");
  const rows = inventory.products.map((product) => {
    const locations = inventory.godowns.filter((location) => !godown || location.id === godown);
    const quantities = locations.flatMap((location) => {
      const quantity = ledger.balances.get(balanceKey(product.id, location.id));
      return quantity === undefined ? [] : [quantity];
    });
    const statuses = quantities.map((quantity) => stockStatus(quantity, product.minimum));
    const out = statuses.filter((value) => value === "Out of stock").length;
    const low = statuses.filter((value) => value === "Low stock").length;
    const worst = out ? "Out of stock" : low ? "Low stock" : quantities.length ? "In stock" : "No history";
    return { product, total: quantities.reduce((sum, quantity) => sum + quantity, 0), worst, low, out };
  }).filter((row) => (!status || row.worst === status) && matches(query, row.product.name, row.product.code));

  return <>
    <Heading title="Stock" description="Manage the product catalog and check stock across godowns." actions={<>
      <Link className="button secondary" href={`/stock/opening/new${godown ? `/${godown}` : ""}`}><PackagePlus size={17} />Opening stock</Link>
      <Link className="button primary" href="/stock/new"><Plus size={17} />Add product</Link>
    </>} />
    <section className="card">
      <CardHeading title="Product inventory" description={`${rows.length} ${rows.length === 1 ? "product" : "products"}`} />
      <div className="filters">
        <SearchBox value={query} onChange={setQuery} label="Search by name or code" />
        <GodownFilter value={godown} onChange={setGodown} />
        <StatusFilter value={status} onChange={setStatus} statuses={stockStatuses} />
      </div>
      {rows.length ? <Table label="Product inventory" headers={["Product code", "Product", "Unit", "On hand", "Minimum", "Status", ""]}>
        {rows.map(({ product, total, worst, low, out }) => <tr key={product.id}>
          <td><span className="product-code">{product.code}</span></td>
          <td><Link className="cell-link" href={productPath(product.id, godown)}>{product.name}</Link></td>
          <td>{product.unit}</td><td className="numeric">{number(total)}</td><td className="numeric">{number(product.minimum)}</td>
          <td><Badge>{worst}</Badge>{!godown && low + out > 0 && <small>{[out ? `${out} out` : "", low ? `${low} low` : ""].filter(Boolean).join(" · ")} by godown</small>}</td>
          <td><Link className="row-link" href={productPath(product.id, godown)} aria-label={`View ${product.name}`}><ChevronRight size={17} /></Link></td>
        </tr>)}
      </Table> : <Empty title="No matching products" description="Try another search or change the filters." />}
    </section>
  </>;
}

export function ProductForm() {
  const [form, setForm] = useState({ name: "", code: "", unit: "", minimum: "0" });
  const { error, busy, save } = useSave();
  const router = useRouter();
  const fields = [
    { key: "name", label: "Product name", placeholder: "e.g. A4 Copier Paper", max: 100 },
    { key: "code", label: "Product code", placeholder: "e.g. PAP-001", max: 32 },
    { key: "unit", label: "Unit of measure", placeholder: "e.g. ream, box, pcs", max: 24 },
    { key: "minimum", label: "Minimum quantity", placeholder: "0", max: 16 },
  ] as const;
  return <>
    <Heading title="Add product" description="Create one product record to use across all godowns." back={{ href: "/stock", label: "Stock" }} />
    <EntryForm cancel="/stock" label="Add product" error={error} busy={busy} onSubmit={async (event) => {
      event.preventDefault();
      const result = await save((state) => addProduct(state, { ...form, minimum: parseQuantity(form.minimum) }), "Product added.");
      if (result) router.push(productPath(result.products.at(-1)!.id));
    }}>
      <div className="form-grid">{fields.map(({ key, label, placeholder, max }) => <Field label={label} key={key} hint={key === "minimum" ? "Used to flag low stock at each godown." : undefined}>
        <input required maxLength={max} inputMode={key === "minimum" ? "numeric" : undefined} value={form[key]} placeholder={placeholder} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
      </Field>)}</div>
    </EntryForm>
  </>;
}

export function OpeningForm({ initialGodown = "", initialProduct = "" }: { initialGodown?: string; initialProduct?: string }) {
  const { inventory, ledger } = useWorkspace();
  const [productId, setProductId] = useState(initialProduct);
  const [godownId, setGodownId] = useState(initialGodown);
  const [quantity, setQuantity] = useState("");
  const { error, busy, save } = useSave();
  const router = useRouter();
  const cancel = initialProduct ? productPath(initialProduct, initialGodown) : initialGodown ? `/godowns/${initialGodown}` : "/stock";
  const hasHistory = ledger.balances.has(balanceKey(productId, godownId));
  return <>
    <Heading title="Record opening stock" description="Set a starting balance for a product with no stock history at this godown." back={{ href: cancel, label: "Back to stock" }} />
    <EntryForm cancel={cancel} label="Record opening stock" error={error} busy={busy} onSubmit={async (event) => {
      event.preventDefault();
      const result = await save((state) => recordOpening(state, { godownId, productId, quantity: parseQuantity(quantity) }), "Opening stock recorded.");
      if (result) router.push(productPath(productId, godownId));
    }}>
      <div className="form-grid">
        <Field label="Product"><Select required value={productId} onChange={(event) => setProductId(event.target.value)}>
          <option value="">Select a product</option>
          {inventory.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.code}</option>)}
        </Select></Field>
        <Field label="Godown" hint={hasHistory ? "This product already has stock history here." : undefined}><Select required value={godownId} onChange={(event) => setGodownId(event.target.value)}>
          <option value="">Select a godown</option>
          {inventory.godowns.map((godown) => <option key={godown.id} value={godown.id}>{godown.name}</option>)}
        </Select></Field>
        <Field label="Quantity"><input required inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="e.g. 50" /></Field>
      </div>
    </EntryForm>
  </>;
}

export function ProductDetail({ product, godownId }: { product: Product; godownId?: string }) {
  const { inventory, ledger, godowns } = useWorkspace();
  const locations = inventory.godowns.map((godown) => ({ godown, quantity: ledger.balances.get(balanceKey(product.id, godown.id)) }));
  const location = godownId ? godowns.get(godownId) : undefined;
  const rows = ledger.history.filter((movement) => movement.productId === product.id && (!location || movement.godownId === location.id)).reverse();
  const quantity = location ? ledger.balances.get(balanceKey(product.id, location.id)) ?? 0 : locations.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  return <>
    <Heading title={product.name} description={`${product.code} · ${product.unit}${location ? ` · ${location.name}` : ""}`} back={{ href: "/stock", label: "Stock" }} actions={
      <Link href={`/stock/opening/new/${godownId ?? "all"}/${product.id}`} className="button secondary"><PackagePlus size={17} />Opening stock</Link>
    } />
    <section className="card detail-card">
      <CardHeading title="Stock by godown" />
      <dl className="detail-grid">
        <div><dt>{location ? `On hand at ${location.name}` : "Total on hand"}</dt><dd>{number(quantity)} {product.unit}</dd></div>
        <div><dt>Minimum per godown</dt><dd>{number(product.minimum)} {product.unit}</dd></div>
      </dl>
      <Table label="Stock by godown" headers={["Godown", "On hand", "Status", ""]}>
        {locations.map(({ godown, quantity }) => <tr key={godown.id} className={godown.id === godownId ? "selected-row" : undefined}>
          <td><Link href={`/godowns/${godown.id}`} className="cell-link">{godown.name}</Link></td>
          <td className="numeric">{number(quantity ?? 0)}</td><td><Badge>{stockStatus(quantity, product.minimum)}</Badge></td>
          <td><Link className="reference" href={productPath(product.id, godown.id)} aria-current={godown.id === godownId ? "location" : undefined}>{godown.id === godownId ? "Viewing history" : "View history"}</Link></td>
        </tr>)}
      </Table>
    </section>
    <section className="card section-space">
      <CardHeading title="Movement history" description={location?.name ?? "All Godowns"} actions={location && <Link href={productPath(product.id)} className="button secondary">Show all godowns</Link>} />
      <MovementTable rows={rows} detailed />
    </section>
  </>;
}

export function OpeningDetail({ id }: { id: string }) {
  const { ledger, products, godowns } = useWorkspace();
  const movement = ledger.history.find((entry) => entry.kind === "opening" && entry.reference === id);
  if (!movement) return <Missing label="Opening stock entry" href="/stock" />;
  return <>
    <Heading title={id} description="Opening stock entry" back={{ href: productPath(movement.productId, movement.godownId), label: "Product details" }} />
    <section className="card detail-card">
      <CardHeading title="Entry details" />
      <dl className="detail-grid">
        <div><dt>Product</dt><dd><Link href={productPath(movement.productId, movement.godownId)}>{products.get(movement.productId)?.name}</Link></dd></div>
        <div><dt>Godown</dt><dd><Link href={`/godowns/${movement.godownId}`}>{godowns.get(movement.godownId)?.name}</Link></dd></div>
        <div><dt>Quantity</dt><dd>{number(movement.quantity)} {products.get(movement.productId)?.unit}</dd></div>
        <div><dt>Recorded on</dt><dd>{date(movement.at)}</dd></div>
      </dl>
    </section>
  </>;
}
