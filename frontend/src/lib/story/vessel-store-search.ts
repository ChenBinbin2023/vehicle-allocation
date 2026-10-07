import type { OrderStore } from "./vessel-orders";
import { matchesLocalizedText } from "../i18n/translate";

export function matchesOrderStore(store: OrderStore, keyword: string) {
  return matchesLocalizedText(
    `${store.id} ${store.shortName} ${store.name} ${store.city} ${store.channel}`,
    keyword,
  );
}
