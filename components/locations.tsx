"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowRight, ArrowRightLeft, ArrowUpRight, ChevronRight, CircleAlert, MapPin, Package, Pencil, Plus, Warehouse } from "lucide-react";
import { useState } from "react";
import { date, number, parseQuantity } from "../lib/format";
import { balanceKey, saveGodown, stockStatus, transferStock, type Godown } from "../lib/inventory";
import { BackLink, Badge, CardHeading, Empty, EntryForm, Field, Heading, MovementList, MovementTable, SearchBox, Select, Table, matches, productPath, useSave, useWorkspace } from "./ui";

const godownPath = (id: string) => `/godowns/${id}`;

export function Godowns() {
  const { inventory, ledger } = useWorkspace();
  const [query, setQuery] = useState("");
  const locations = inventory.godowns.filter((godown) => matches(query, godown.name));
  return <>
    <Heading title="Godowns" description="Manage inventory locations and see what’s in stock at each." actions={
      <Link href="/godowns/new" className="button primary"><Plus size={17} />Add godown</Link>
    } />
    <div className="listing-filters"><SearchBox value={query} onChange={setQuery} label="Search godowns" /><span>{locations.length} {locations.length === 1 ? "godown" : "godowns"}</span></div>
    {locations.length ? <div className="location-grid">{locations.map((godown) => {
      const quantities = inventory.products.flatMap((product) => {
        const quantity = ledger.balances.get(balanceKey(product.id, godown.id));
        return quantity === undefined ? [] : [{ quantity, status: stockStatus(quantity, product.minimum) }];
      });
      const alerts = quantities.filter(({ status }) => status !== "In stock").length;
      return <Link href={godownPath(godown.id)} className="card location-card" key={godown.id}>
        <LocationImage godown={godown} />
        <div className="location-card-body">
          <div className="location-title">
            <div><h2>{godown.name}</h2>{godown.address && <p><MapPin size={14} />{godown.address}</p>}</div>
            <span className="icon-tile indigo"><ArrowUpRight size={18} /></span>
          </div>
          <div className="location-card-stats">
            <span><Package size={16} /><strong>{quantities.length}</strong> products</span>
            <span><CircleAlert size={16} /><strong>{alerts}</strong> stock alerts</span>
          </div>
        </div>
      </Link>;
    })}</div> : <div className="card"><Empty title="No godowns found" description="Try another name or add a godown." /></div>}
  </>;
}

function LocationImage({ godown }: { godown: Godown }) {
  return <div className="location-image" aria-hidden="true">
    {godown.image ? <Image src={godown.image} alt="" fill sizes="(max-width: 760px) 100vw, 50vw" />
      : <Warehouse size={54} strokeWidth={1.25} />}
  </div>;
}

export function GodownDetail({ godown }: { godown: Godown }) {
  const { inventory, ledger } = useWorkspace();
  const [query, setQuery] = useState("");
  const [allMovements, setAllMovements] = useState(false);
  const history = ledger.history.filter((movement) => movement.godownId === godown.id).reverse();
  const tracked = inventory.products.flatMap((product) => {
    const quantity = ledger.balances.get(balanceKey(product.id, godown.id));
    return quantity === undefined ? [] : [{ product, quantity, status: stockStatus(quantity, product.minimum) }];
  });
  const rows = tracked.filter(({ product }) => matches(query, product.name, product.code));
  const alerts = tracked.filter(({ status }) => status !== "In stock").length;

  return <>
    <BackLink href="/godowns" label="Godowns" />
    <section className="location-hero">
      <LocationImage godown={godown} />
      <div className="hero-content">
        <span className="icon-tile"><Warehouse size={23} /></span>
        <h1>{godown.name}</h1>
        {godown.address && <p><MapPin size={16} />{godown.address}</p>}
        <div className="hero-stats">
          <div><strong>{number(tracked.length)}</strong><span>Tracked products</span></div>
          <div><strong>{number(tracked.reduce((sum, row) => sum + row.quantity, 0))}</strong><span>Units on hand</span></div>
          <div><strong>{number(alerts)}</strong><span>Stock alerts</span></div>
        </div>
      </div>
    </section>
    <div className="card location-actions">
      <div className="actions">
        <Link href={`/purchases/new/${godown.id}`} className="button primary"><ArrowDownLeft size={17} />Stock In</Link>
        <Link href={`/sales/new/${godown.id}`} className="button secondary"><ArrowUpRight size={17} />Stock Out</Link>
        <Link href={`/godowns/${godown.id}/transfer`} className="button secondary"><ArrowRightLeft size={17} />Transfer</Link>
      </div>
      <Link href={`/godowns/${godown.id}/rename`} className="button subtle"><Pencil size={15} />Rename</Link>
    </div>
    <div className="location-detail-grid">
      <section className="card">
        <CardHeading title="Stock on hand" description={`${tracked.length} tracked ${tracked.length === 1 ? "product" : "products"}`} />
        {!!tracked.length && <div className="filters"><SearchBox label="Search by name or code" value={query} onChange={setQuery} /></div>}
        {rows.length ? <Table label="Godown stock" headers={["Product", "On hand", "Minimum", "Status", ""]}>
          {rows.map(({ product, quantity, status }) => <tr key={product.id}>
            <td><Link className="cell-link" href={productPath(product.id, godown.id)}>{product.name}</Link><small>{product.code}</small></td>
            <td className="numeric">{number(quantity)} <span className="muted">{product.unit}</span></td>
            <td className="numeric">{number(product.minimum)}</td>
            <td><Badge>{status}</Badge></td>
            <td><Link href={productPath(product.id, godown.id)} className="row-link" aria-label={`View ${product.name}`}><ChevronRight size={17} /></Link></td>
          </tr>)}
        </Table> : <Empty title={tracked.length ? "No matching products" : "No stock recorded yet"}
          description={tracked.length ? "Try another product name or code." : "Record opening stock or receive a purchase to add your first products here."}
          action={!tracked.length && <Link className="button secondary" href={`/stock/opening/new/${godown.id}`}><Plus size={16} />Record opening stock</Link>} />}
      </section>
      <section className="card">
        <CardHeading title="Recent movements" description="Latest transactions at this godown" />
        <MovementList rows={allMovements ? history : history.slice(0, 6)} />
        {history.length > 6 && <div className="table-footer"><button type="button" className="button secondary" onClick={() => setAllMovements(!allMovements)}>
          {allMovements ? "Show recent movements" : "Show all movements"}<ArrowRight size={15} />
        </button></div>}
      </section>
    </div>
  </>;
}

export function GodownForm({ godown }: { godown?: Godown }) {
  const [name, setName] = useState(godown?.name ?? "");
  const { error, busy, save } = useSave();
  const router = useRouter();
  const cancel = godown ? godownPath(godown.id) : "/godowns";
  return <>
    <Heading title={godown ? "Rename godown" : "Add godown"} description={godown ? "Update the name shown throughout Stockroom." : "Create a location for receiving, dispatching, and tracking stock."} back={{ href: cancel, label: godown?.name ?? "Godowns" }} />
    <EntryForm cancel={cancel} label={godown ? "Save name" : "Add godown"} error={error} busy={busy} onSubmit={async (event) => {
      event.preventDefault();
      const result = await save((state) => saveGodown(state, name, godown?.id), godown ? "Godown renamed." : "Godown added.");
      if (result) router.push(godownPath(godown?.id ?? result.godowns.at(-1)!.id));
    }}>
      <Field label="Godown name"><input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Madurai North" /></Field>
    </EntryForm>
  </>;
}

export function TransferForm({ from }: { from: string }) {
  const { inventory, ledger } = useWorkspace();
  const [source, setSource] = useState(from);
  const [destination, setDestination] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const { error, busy, save } = useSave();
  const router = useRouter();
  const cancel = godownPath(from);
  const available = ledger.balances.get(balanceKey(productId, source)) ?? 0;
  return <>
    <Heading title="Transfer stock" description="Move a product between two godowns." back={{ href: cancel, label: "Godown details" }} />
    <EntryForm cancel={cancel} label="Complete transfer" error={error} busy={busy} onSubmit={async (event) => {
      event.preventDefault();
      const result = await save((state) => transferStock(state, { source, destination, productId, quantity: parseQuantity(quantity) }), "Stock transferred.");
      if (result) router.push(`/godowns/transfers/${result.transfers.at(-1)!.id}`);
    }}>
      <div className="form-grid">
        <Field label="Source godown"><Select required value={source} onChange={(event) => setSource(event.target.value)}>
          {inventory.godowns.map((godown) => <option value={godown.id} key={godown.id}>{godown.name}</option>)}
        </Select></Field>
        <Field label="Destination godown"><Select required value={destination} onChange={(event) => setDestination(event.target.value)}>
          <option value="">Select a godown</option>
          {inventory.godowns.map((godown) => <option value={godown.id} key={godown.id}>{godown.name}</option>)}
        </Select></Field>
      </div>
      <div className="form-grid">
        <Field label="Product" hint={productId ? `${number(available)} available at the source` : undefined}><Select required value={productId} onChange={(event) => setProductId(event.target.value)}>
          <option value="">Select a product</option>
          {inventory.products.map((product) => <option value={product.id} key={product.id}>{product.name} · {product.code}</option>)}
        </Select></Field>
        <Field label="Quantity"><input required inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="e.g. 10" /></Field>
      </div>
    </EntryForm>
  </>;
}

export function TransferDetail({ id }: { id: string }) {
  const { inventory, ledger, products, godowns } = useWorkspace();
  const transfer = inventory.transfers.find((item) => item.id === id);
  if (!transfer) return <Missing label="Transfer" href="/godowns" />;
  const { source, destination, productId, quantity, at } = transfer;
  return <>
    <Heading title={id} description="Godown stock transfer" back={{ href: godownPath(source), label: godowns.get(source)!.name }} actions={<Badge>Completed</Badge>} />
    <section className="card detail-card">
      <CardHeading title="Transfer details" />
      <dl className="detail-grid">
        <div><dt>Source godown</dt><dd><Link href={godownPath(source)}>{godowns.get(source)?.name}</Link></dd></div>
        <div><dt>Destination godown</dt><dd><Link href={godownPath(destination)}>{godowns.get(destination)?.name}</Link></dd></div>
        <div><dt>Product</dt><dd><Link href={productPath(productId)}>{products.get(productId)?.name}</Link></dd></div>
        <div><dt>Quantity</dt><dd>{number(quantity)} {products.get(productId)?.unit}</dd></div>
        <div><dt>Transferred on</dt><dd>{date(at)}</dd></div>
      </dl>
    </section>
    <section className="card section-space"><CardHeading title="Transfer movements" /><MovementTable detailed rows={ledger.history.filter((movement) => movement.reference === id)} /></section>
  </>;
}

export function Missing({ label, href }: { label: string; href: string }) {
  return <div className="card"><Empty title={`${label} not found`} description="Check the link or return to the list." action={<Link href={href} className="button secondary">Go back</Link>} /></div>;
}
