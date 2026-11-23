"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ChartNoAxesCombined, CheckCircle2, ChevronRight, House, LayoutDashboard, Menu, Package, ShoppingBag, ShoppingCart, Warehouse, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dashboard } from "./dashboard";
import { GodownDetail, GodownForm, Godowns, Missing, TransferDetail, TransferForm } from "./locations";
import { OrderDetail, OrderForm, Orders } from "./orders";
import { Reports } from "./reports";
import { OpeningDetail, OpeningForm, ProductDetail, ProductForm, Stock } from "./stock";
import { ToastContext, useWorkspace } from "./ui";

const groups = [
  { label: "Workspace", links: [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/godowns", label: "Godowns", icon: Warehouse },
    { path: "/stock", label: "Stock", icon: Package },
  ] },
  { label: "Operations", links: [
    { path: "/sales", label: "Sales", icon: ShoppingBag },
    { path: "/purchases", label: "Purchases", icon: ShoppingCart },
    { path: "/reports", label: "Reports", icon: ChartNoAxesCombined },
  ] },
];

export function Stockroom() {
  const pathname = usePathname();
  const sections = pathname.split("/").filter(Boolean);
  const main = sections.length ? `/${sections[0]}` : "/";
  const title = groups.flatMap((group) => group.links).find((link) => link.path === main)?.label ?? "Stockroom";
  const [drawerPath, setDrawerPath] = useState("");
  const [toast, setToast] = useState("");
  const drawerOpen = drawerPath === pathname;
  const menuToggle = useRef<HTMLButtonElement>(null);
  const drawerClose = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (drawerOpen) drawerClose.current?.focus();
  }, [drawerOpen]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 5500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function closeDrawer() {
    setDrawerPath("");
    menuToggle.current?.focus();
  }

  return <ToastContext.Provider value={setToast}>
    <div className="workspace">
      <a className="skip-link" href="#main">Skip to content</a>
      {drawerOpen && <div className="drawer-overlay" aria-hidden="true" onClick={closeDrawer} />}
      <aside id="primary-sidebar" className={`sidebar${drawerOpen ? " drawer-open" : ""}`} onKeyDown={(event) => {
        if (event.key === "Escape") closeDrawer();
      }}>
        <button ref={drawerClose} type="button" className="icon-button drawer-close" aria-label="Close navigation" onClick={closeDrawer}><X size={17} /></button>
        <Link href="/" className="brand" onClick={() => setDrawerPath("")}>
          <span className="brand-mark"><Boxes size={22} strokeWidth={1.9} /></span>
          <span>Stockroom<small>Inventory management</small></span>
        </Link>
        <nav aria-label="Primary navigation">
          {groups.map((group) => <div key={group.label} className="nav-group">
            <div className="nav-label">{group.label}</div>
            {group.links.map(({ path, label, icon: Icon }) => <Link href={path} className={main === path ? "active" : ""} aria-current={main === path ? "location" : undefined} key={path} onClick={() => setDrawerPath("")}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{main === path && <ChevronRight size={15} />}
            </Link>)}
          </div>)}
        </nav>
        <div className="sidebar-footer"><span className="workspace-mark">SS</span><div><strong>SasthaSoft</strong><small>Trial workspace</small></div></div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button ref={menuToggle} type="button" className="icon-button mobile-menu" aria-label={drawerOpen ? "Toggle navigation" : "Open navigation"} aria-controls="primary-sidebar" aria-expanded={drawerOpen} onClick={() => setDrawerPath(drawerOpen ? "" : pathname)}>
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/" aria-label="Dashboard home"><House size={16} /></Link><ChevronRight size={14} />
            {sections.length > 1 ? <Link href={main}>{title}</Link> : <span>{title}</span>}
            {sections.length > 1 && <><ChevronRight size={14} /><span>{sections.includes("new") ? "New" : sections.includes("rename") ? "Rename" : sections.at(-1) === "transfer" ? "Transfer" : "Details"}</span></>}
          </nav>
          <span className="local-indicator" title="Changes are saved in this browser"><i />Local workspace</span>
        </header>
        <main id="main" tabIndex={-1} className="main-content" key={pathname}><Screen sections={sections} /></main>
      </div>
      <div className="toast-region" role="status" aria-live="polite">
        {toast && <div className="toast"><CheckCircle2 size={20} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setToast("")}><X size={16} /></button></div>}
      </div>
    </div>
  </ToastContext.Provider>;
}

function Screen({ sections }: { sections: string[] }) {
  const { products, godowns } = useWorkspace();
  const [main, id, action, detail] = sections;
  if (!main) return <Dashboard />;
  if (main === "godowns") {
    if (!id) return <Godowns />;
    if (id === "new") return <GodownForm />;
    if (id === "transfers" && action) return <TransferDetail id={action} />;
    const godown = godowns.get(id);
    if (!godown) return <Missing label="Godown" href="/godowns" />;
    if (action === "rename") return <GodownForm godown={godown} />;
    if (action === "transfer") return <TransferForm from={godown.id} />;
    return <GodownDetail godown={godown} />;
  }
  if (main === "stock") {
    if (!id) return <Stock />;
    if (id === "new") return <ProductForm />;
    if (id === "opening" && action === "new") {
      const godown = godowns.has(detail) ? detail : "";
      const product = products.has(sections[4]) ? sections[4] : "";
      return <OpeningForm key={`${godown}/${product}`} initialGodown={godown} initialProduct={product} />;
    }
    if (id === "opening" && action) return <OpeningDetail id={action} />;
    const product = products.get(id);
    if (!product) return <Missing label="Product" href="/stock" />;
    return <ProductDetail product={product} godownId={godowns.has(action) ? action : undefined} />;
  }
  if (main === "sales" || main === "purchases") {
    const kind = main === "sales" ? "sale" : "purchase";
    if (!id) return <Orders kind={kind} />;
    if (id === "new") {
      const godown = godowns.has(action) ? action : "";
      return <OrderForm key={godown} kind={kind} initialGodown={godown} />;
    }
    return <OrderDetail kind={kind} id={id} />;
  }
  if (main === "reports") return <Reports report={id === "sales" || id === "purchases" ? id : "stock"} />;
  return <Missing label="Page" href="/" />;
}
