export type Godown = { id: string; name: string; address?: string; image?: string };
export type Product = { id: string; code: string; name: string; unit: string; minimum: number };
export type Line = { productId: string; quantity: number; unitPaise: number };
export type OrderKind = "sale" | "purchase";
export type Order = {
  id: string;
  kind: OrderKind;
  partner: string;
  godownId: string;
  createdAt: string;
  postedAt?: string;
  lines: Line[];
};
export type MovementKind = "opening" | "purchase" | "sale" | "transfer";
export type Movement = {
  productId: string;
  godownId: string;
  quantity: number;
  kind: MovementKind;
  reference: string;
  at: string;
};
export type Transfer = {
  id: string;
  source: string;
  destination: string;
  productId: string;
  quantity: number;
  at: string;
};
export type Inventory = {
  godowns: Godown[];
  products: Product[];
  orders: Order[];
  movements: Movement[];
  transfers: Transfer[];
};
export type StockStatus = "In stock" | "Low stock" | "Out of stock" | "No history";

export const movementLabels: Record<MovementKind, string> = {
  opening: "Opening stock",
  purchase: "Stock In",
  sale: "Stock Out",
  transfer: "Transfer",
};

export function balanceKey(productId: string, godownId: string) {
  return JSON.stringify([productId, godownId]);
}

export function readLedger(movements: Movement[]) {
  const balances = new Map<string, number>();
  const history = movements.map((movement) => {
    const key = balanceKey(movement.productId, movement.godownId);
    const before = balances.get(key) ?? 0;
    const after = before + movement.quantity;
    balances.set(key, after);
    return { ...movement, before, after };
  });
  return { balances, history };
}

export function stockStatus(quantity: number | undefined, minimum: number): StockStatus {
  if (quantity === undefined) return "No history";
  if (quantity === 0) return "Out of stock";
  return quantity <= minimum ? "Low stock" : "In stock";
}

export function orderTotal(lines: Line[]) {
  return lines.reduce((total, line) => total + line.quantity * line.unitPaise, 0);
}

export function orderStatus(order: Order) {
  if (order.kind === "sale") return order.postedAt ? "Completed" : "Draft";
  return order.postedAt ? "Received" : "Pending";
}

function required(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Enter ${label}.`);
  return trimmed;
}

function positiveQuantity(quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Enter a positive whole-number quantity.");
  }
}

function getProduct(state: Inventory, id: string) {
  const product = state.products.find((item) => item.id === id);
  if (!product) throw new Error("Select a product.");
  return product;
}

function getGodown(state: Inventory, id: string) {
  const godown = state.godowns.find((item) => item.id === id);
  if (!godown) throw new Error("Select a godown.");
  return godown;
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export function saveGodown(state: Inventory, name: string, id?: string): Inventory {
  name = required(name, "a godown name");
  if (state.godowns.some((godown) => godown.id !== id && godown.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("A godown with that name already exists.");
  }
  if (id) {
    getGodown(state, id);
    return { ...state, godowns: state.godowns.map((godown) => godown.id === id ? { ...godown, name } : godown) };
  }
  return { ...state, godowns: [...state.godowns, { id: nextId("g", state.godowns.length), name }] };
}

export function addProduct(state: Inventory, input: Omit<Product, "id">): Inventory {
  const name = required(input.name, "a product name");
  const code = required(input.code, "a product code");
  const unit = required(input.unit, "a unit of measure");
  if (!Number.isSafeInteger(input.minimum) || input.minimum < 0) {
    throw new Error("Enter a nonnegative whole-number minimum quantity.");
  }
  if (state.products.some((product) => product.code.toLowerCase() === code.toLowerCase())) {
    throw new Error("That product code is already in use.");
  }
  const product = { id: nextId("p", state.products.length), name, code, unit, minimum: input.minimum };
  return { ...state, products: [...state.products, product] };
}

export function recordOpening(
  state: Inventory,
  input: Pick<Movement, "productId" | "godownId" | "quantity">,
  at = new Date().toISOString(),
): Inventory {
  getProduct(state, input.productId);
  getGodown(state, input.godownId);
  positiveQuantity(input.quantity);
  if (state.movements.some((movement) => movement.productId === input.productId && movement.godownId === input.godownId)) {
    throw new Error("This product already has stock history at the selected godown.");
  }
  const count = state.movements.filter((movement) => movement.kind === "opening").length;
  return {
    ...state,
    movements: [...state.movements, { ...input, kind: "opening", reference: nextId("OB", count), at }],
  };
}

function validateLines(state: Inventory, lines: Line[]) {
  if (!lines.length) throw new Error("Add at least one product.");
  const totals = new Map<string, number>();
  for (const [index, line] of lines.entries()) {
    const label = `Line ${index + 1}`;
    if (!state.products.some((product) => product.id === line.productId)) {
      throw new Error(`${label}: select a product.`);
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`${label}: enter a positive whole-number quantity.`);
    }
    if (!Number.isSafeInteger(line.unitPaise) || line.unitPaise < 0) {
      throw new Error(`${label}: enter a valid INR amount with up to two decimal places.`);
    }
    const quantity = (totals.get(line.productId) ?? 0) + line.quantity;
    if (!Number.isSafeInteger(quantity)) throw new Error(`${label}: combined quantity is too large.`);
    totals.set(line.productId, quantity);
  }
  if (!Number.isSafeInteger(orderTotal(lines))) throw new Error("The order amount is too large.");
  return totals;
}

export function createOrder(
  state: Inventory,
  input: Pick<Order, "kind" | "partner" | "godownId" | "lines">,
  at = new Date().toISOString(),
): Inventory {
  getGodown(state, input.godownId);
  const partner = required(input.partner, input.kind === "sale" ? "a customer" : "a supplier");
  validateLines(state, input.lines);
  const count = state.orders.filter((order) => order.kind === input.kind).length;
  const id = nextId(input.kind === "sale" ? "SO" : "PO", count);
  return { ...state, orders: [...state.orders, { ...input, partner, id, createdAt: at }] };
}

export function postOrder(state: Inventory, id: string, at = new Date().toISOString()): Inventory {
  const order = state.orders.find((item) => item.id === id);
  if (!order) throw new Error("This order could not be found.");
  if (order.postedAt) return state;
  const godown = getGodown(state, order.godownId);
  const totals = validateLines(state, order.lines);
  const { balances } = readLedger(state.movements);
  const movements: Movement[] = [];
  for (const [productId, quantity] of totals) {
    const available = balances.get(balanceKey(productId, godown.id)) ?? 0;
    if (order.kind === "sale" && quantity > available) {
      throw new Error(`${getProduct(state, productId).name} has ${available} available at ${godown.name}. This order needs ${quantity}.`);
    }
    if (order.kind === "purchase" && !Number.isSafeInteger(available + quantity)) {
      throw new Error("The receipt would exceed the supported stock balance.");
    }
    movements.push({
      productId, godownId: godown.id, quantity: order.kind === "sale" ? -quantity : quantity,
      kind: order.kind, reference: id, at,
    });
  }
  return {
    ...state,
    orders: state.orders.map((item) => item.id === id ? { ...item, postedAt: at } : item),
    movements: [...state.movements, ...movements],
  };
}

export function transferStock(
  state: Inventory,
  input: Omit<Transfer, "id" | "at">,
  at = new Date().toISOString(),
): Inventory {
  const source = getGodown(state, input.source);
  const destination = getGodown(state, input.destination);
  const product = getProduct(state, input.productId);
  positiveQuantity(input.quantity);
  if (source.id === destination.id) throw new Error("Choose a destination different from the source.");
  const { balances } = readLedger(state.movements);
  const available = balances.get(balanceKey(product.id, source.id)) ?? 0;
  if (input.quantity > available) {
    throw new Error(`${product.name} has ${available} available at ${source.name}.`);
  }
  const destinationBalance = balances.get(balanceKey(product.id, destination.id)) ?? 0;
  if (!Number.isSafeInteger(destinationBalance + input.quantity)) {
    throw new Error("The transfer would exceed the supported destination balance.");
  }
  const id = nextId("TR", state.transfers.length);
  const movement = { productId: product.id, kind: "transfer" as const, reference: id, at };
  return {
    ...state,
    transfers: [...state.transfers, { ...input, id, at }],
    movements: [
      ...state.movements,
      { ...movement, godownId: source.id, quantity: -input.quantity },
      { ...movement, godownId: destination.id, quantity: input.quantity },
    ],
  };
}
