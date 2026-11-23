import { createOrder, postOrder, recordOpening, transferStock, type Inventory, type Line, type OrderKind } from "./inventory";

const products = [
  { id: "p-0001", name: "A4 Copier Paper", code: "PAP-001", unit: "ream", minimum: 20 },
  { id: "p-0002", name: "Blue Ballpoint Pens", code: "PEN-002", unit: "box", minimum: 12 },
  { id: "p-0003", name: "A5 Ruled Notebooks", code: "NOT-003", unit: "pcs", minimum: 15 },
  { id: "p-0004", name: "Black Lever Arch Files", code: "FIL-004", unit: "pcs", minimum: 8 },
  { id: "p-0005", name: "Sticky Notes 3×3", code: "NOT-005", unit: "pad", minimum: 10 },
  { id: "p-0006", name: "Whiteboard Markers", code: "MAR-006", unit: "set", minimum: 10 },
  { id: "p-0007", name: "Desk Stapler No. 10", code: "STP-007", unit: "pcs", minimum: 8 },
  { id: "p-0008", name: "Binder Clips 32 mm", code: "CLP-008", unit: "box", minimum: 8 },
  { id: "p-0009", name: "Brown Packing Tape", code: "TAP-009", unit: "roll", minimum: 10 },
  { id: "p-0010", name: "DL Window Envelopes", code: "ENV-010", unit: "box", minimum: 6 },
  { id: "p-0011", name: "Correction Tape 5 mm", code: "TAP-011", unit: "pcs", minimum: 10 },
  { id: "p-0012", name: "Permanent Markers", code: "MAR-012", unit: "set", minimum: 8 },
];

const central = "g-0001";
const south = "g-0002";
const timestamp = (day: number, time = "09:30") => `2026-11-${String(day).padStart(2, "0")}T${time}:00+05:30`;

function seedInventory(): Inventory {
  let state: Inventory = {
    products,
    godowns: [
      { id: central, name: "Chennai Central", address: "Ambattur, Chennai", image: "/godown-central.webp" },
      { id: south, name: "Coimbatore South", address: "Kurichi, Coimbatore", image: "/godown-south.webp" },
    ],
    orders: [], movements: [], transfers: [],
  };

  const openings = [
    [120, 42], [60, 24], [60, 32], [28, 0], [30, 0], [24, 18],
    [22, 18], [36, 24], [42, 28], [24, 12], [32, 0], [24, 0],
  ];
  openings.forEach(([first, second], index) => {
    for (const [godownId, quantity] of [[central, first], [south, second]] as const) {
      if (quantity) state = recordOpening(state, { productId: products[index].id, godownId, quantity }, timestamp(12));
    }
  });

  function order(kind: OrderKind, partner: string, godownId: string, day: number, posted: boolean, items: number[][], time?: string) {
    const lines: Line[] = items.map(([index, quantity, unitPaise]) => ({ productId: products[index].id, quantity, unitPaise }));
    state = createOrder(state, { kind, partner, godownId, lines }, timestamp(posted ? day - 1 : day));
    if (posted) state = postOrder(state, state.orders[state.orders.length - 1].id, timestamp(day, time));
  }

  order("purchase", "Sundaram Paper Traders", central, 17, true, [[0, 60, 26000], [4, 24, 4400]]);
  order("sale", "Maple Desk Co.", central, 17, true, [[4, 45, 6500], [11, 14, 28000]], "15:00");
  order("purchase", "Kovai Office Supplies", south, 18, true, [[2, 36, 8500], [8, 24, 3200]]);
  order("sale", "Northline Design Studio", central, 18, true, [[3, 28, 42000], [0, 32, 33000]], "14:15");
  order("purchase", "Metro Stationery Supply", central, 19, true, [[6, 35, 12000], [10, 16, 4900]]);
  order("sale", "Fern & Form Interiors", south, 19, true, [[8, 16, 4800], [2, 24, 12000]], "16:00");
  order("purchase", "Lotus Office Mart", south, 20, true, [[7, 40, 7800], [1, 24, 17500]]);
  order("sale", "Kaveri Workspace", south, 20, true, [[9, 12, 24000], [0, 14, 35000]], "15:25");
  state = transferStock(state, { source: central, destination: south, productId: products[0].id, quantity: 24 }, timestamp(21, "11:20"));
  order("sale", "Cobalt Learning Centre", central, 21, true, [[5, 19, 31000], [2, 18, 11900]], "14:40");
  order("purchase", "Sundaram Paper Traders", central, 22, true, [[0, 72, 25500], [8, 36, 2900]]);
  order("sale", "Blue Fig Technologies", south, 22, true, [[1, 40, 24500], [2, 10, 12500]], "15:20");
  order("purchase", "Pioneer Paper & Pack", central, 23, true, [[7, 24, 7300], [2, 18, 8400]], "09:40");
  state = transferStock(state, { source: central, destination: south, productId: products[6].id, quantity: 16 }, timestamp(23, "10:15"));
  order("sale", "Meridian Coworks", central, 23, true, [[0, 36, 32900], [10, 12, 9700]], "11:10");

  order("purchase", "Metro Stationery Supply", central, 22, false, [[3, 42, 32000], [5, 20, 19500]]);
  order("purchase", "Kovai Office Supplies", south, 23, false, [[9, 18, 18200], [1, 30, 16500]]);
  order("purchase", "Lotus Office Mart", central, 23, false, [[4, 40, 4200]]);
  order("sale", "Harbourline Consultants", central, 23, false, [[0, 16, 33500], [7, 8, 13200]]);
  order("sale", "Cedar People Ops", south, 23, false, [[6, 12, 18500], [2, 20, 11500]]);
  return state;
}

export const seed = seedInventory();
