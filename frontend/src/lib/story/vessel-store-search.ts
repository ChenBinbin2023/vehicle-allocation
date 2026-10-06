import type { OrderStore } from "./vessel-orders";

export function matchesOrderStore(store: OrderStore, keyword: string) {
  const text =
    `${store.id} ${store.shortName} ${store.name} ${store.city}`.toLowerCase();
  return keyword
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((word) => text.includes(word));
}
