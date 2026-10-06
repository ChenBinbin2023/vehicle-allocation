import source from "../query-data.json";

export type QueryTab = "sales" | "inventory" | "transport";
export type QueryDimension = "total" | "region" | "vpc" | "store";
export type QueryFilters = {
  region: string;
  vpc: string;
  store: string;
  channel: string;
  brand: string;
  from: string;
  to: string;
  dimension: QueryDimension;
};
export const defaultQueryFilters: QueryFilters = {
  region: "all",
  vpc: "all",
  store: "all",
  channel: "all",
  brand: "all",
  from: "2026-01",
  to: "2026-10",
  dimension: "total",
};
export const queryVpcLabels: Record<string, string> = {
  JED: "吉达 VPC",
  RUH: "利雅得 VPC",
  DMM: "达曼 VPC",
};
export const queryMetadata = {
  snapshot: source.snapshot,
  stockDate: source.stockDate,
  lastActualMonth: "2026-07",
  capacityWeek: "2026-09-28 — 2026-10-04",
  forecastRule:
    "最近 3 个有效月的日均销量 × 预测月份天数，逐门店、逐品牌取整后汇总。",
  vpcRule:
    "模拟服务关系：吉达服务西部与南部，利雅得服务中部与北部，达曼服务东部。VPC 视图汇总服务门店，不代表 VPC 自有库存。",
};
export const queryMonths = [
  ...source.months.map((row) => row.month),
  "2026-10",
];
export const queryStores = source.stores.map((store) => ({
  ...store,
  vpc:
    store.region === "东部"
      ? "DMM"
      : ["西部", "南部"].includes(store.region)
        ? "JED"
        : "RUH",
}));
export const queryRegions = ["西部", "中部", "东部", "南部", "北部"];
const historyMonths = new Set(
  source.months
    .filter((row) => row.toyota !== null && row.lexus !== null)
    .map((row) => row.month),
);
const salesIndex = new Map(
  source.sales.map((row) => [
    `${row.store}|${row.brand}|${row.month}`,
    row.qty,
  ]),
);
const ageIndex = new Map(
  source.ages.map((row) => [`${row.store}|${row.brand}`, row.aged]),
);
const storeIndex = new Map(queryStores.map((store) => [store.id, store]));
const days = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
};
const matches = (selected: string, value: string) =>
  selected === "all" || selected.split(",").includes(value);
export function selectQueryStores(filters: QueryFilters) {
  return queryStores.filter(
    (store) =>
      matches(filters.region, store.region) &&
      matches(filters.vpc, store.vpc) &&
      matches(filters.store, store.id) &&
      matches(filters.channel, store.channel) &&
      (filters.brand === "all" ||
        store.brands.split(";").includes(filters.brand)),
  );
}
type StockTotals = {
  physical: number;
  free: number;
  locked: number;
  frozen: number;
  transit: number;
  gap: number;
  weekly: number;
  aged: number;
  coverage: number;
};
const blankStock = (): StockTotals => ({
  physical: 0,
  free: 0,
  locked: 0,
  frozen: 0,
  transit: 0,
  gap: 0,
  weekly: 0,
  aged: 0,
  coverage: 0,
});
type StockRow = (typeof source.stock)[number];
function aggregateStock(rows: StockRow[]): StockTotals {
  const total = rows.reduce(
    (sum, row) => ({
      physical: sum.physical + row.physical,
      free: sum.free + row.free,
      locked: sum.locked + row.locked,
      frozen: sum.frozen + row.frozen,
      transit: sum.transit + row.transit,
      gap: sum.gap + row.gap,
      weekly: sum.weekly + row.weekly,
      aged: sum.aged + (ageIndex.get(`${row.store}|${row.brand}`) ?? 0),
      coverage: 0,
    }),
    blankStock(),
  );
  return {
    ...total,
    coverage: total.weekly > 0 ? total.free / total.weekly : 0,
  };
}
function quantity(row: StockRow, month: string): number {
  if (historyMonths.has(month))
    return salesIndex.get(`${row.store}|${row.brand}|${month}`) ?? 0;
  if (month <= queryMetadata.lastActualMonth) return 0;
  const dailyMean =
    ["2026-05", "2026-06", "2026-07"].reduce(
      (sum, historical) =>
        sum +
        (salesIndex.get(`${row.store}|${row.brand}|${historical}`) ?? 0) /
          days(historical),
      0,
    ) / 3;
  return Math.round(dailyMean * days(month));
}

export function queryAnalytics(filters: QueryFilters) {
  const stores = selectQueryStores(filters);
  const ids = new Set(stores.map((store) => store.id));
  const stockRows = source.stock.filter(
    (row) => ids.has(row.store) && matches(filters.brand, row.brand),
  );
  const months = queryMonths.filter(
    (month) => month >= filters.from && month <= filters.to,
  );
  const monthly = months.map((month) => {
    const direct = stockRows
      .filter((row) => storeIndex.get(row.store)!.channel === "直营")
      .reduce((sum, row) => sum + quantity(row, month), 0);
    const authorized = stockRows
      .filter((row) => storeIndex.get(row.store)!.channel === "二级展厅")
      .reduce((sum, row) => sum + quantity(row, month), 0);
    const actual = historyMonths.has(month);
    return {
      month,
      actual: actual ? direct + authorized : null,
      forecast: actual ? null : direct + authorized,
      direct: actual ? direct : null,
      authorized: actual ? authorized : null,
      forecastDirect: actual ? null : direct,
      forecastAuthorized: actual ? null : authorized,
    };
  });
  const groups = new Map<string, typeof stores>();
  for (const store of stores) {
    const key =
      filters.dimension === "total"
        ? "total"
        : filters.dimension === "store"
          ? store.id
          : store[filters.dimension];
    groups.set(key, [...(groups.get(key) ?? []), store]);
  }
  const rows = [...groups.entries()]
    .map(([id, members]) => {
      const memberIds = new Set(members.map((store) => store.id));
      const memberStock = stockRows.filter((row) => memberIds.has(row.store));
      const monthly = months.map((month) => {
        const value = memberStock.reduce(
          (sum, row) => sum + quantity(row, month),
          0,
        );
        return {
          month,
          actual: historyMonths.has(month) ? value : null,
          forecast: historyMonths.has(month) ? null : value,
        };
      });
      return {
        id,
        label:
          filters.dimension === "total"
            ? "总量"
            : filters.dimension === "vpc"
              ? queryVpcLabels[id]
              : filters.dimension === "store"
                ? members[0].name.replace("模拟", "")
                : id,
        storeCount: members.length,
        ...aggregateStock(memberStock),
        monthly,
        actual: monthly.reduce((sum, row) => sum + (row.actual ?? 0), 0),
        forecast: monthly.reduce((sum, row) => sum + (row.forecast ?? 0), 0),
      };
    })
    .sort(
      (a, b) =>
        b.actual - a.actual ||
        b.forecast - a.forecast ||
        a.id.localeCompare(b.id),
    );
  const channels = ["直营", "二级展厅"].map((channel) => {
    const memberIds = new Set(
      stores
        .filter((store) => store.channel === channel)
        .map((store) => store.id),
    );
    return {
      channel,
      label: channel === "直营" ? "直营店" : "授权店（L2）",
      storeCount: memberIds.size,
      ...aggregateStock(stockRows.filter((row) => memberIds.has(row.store))),
    };
  });
  function transport(scenario: "dual" | "west") {
    const mapping = source.mapping.filter(
      (row) => ids.has(row.store) && row[scenario] === "是",
    );
    const routeIds = new Set(mapping.map((row) => row.route));
    const routes = source.routes
      .filter((route) => routeIds.has(route.id))
      .map((route) => {
        const plan = source.scenarioRoutes.find(
          (row) =>
            row.id === route.id &&
            row.scenario === (scenario === "dual" ? "SC-DUAL" : "SC-WEST"),
        )!;
        if (!plan || plan.cost === null)
          throw new Error(`启用路线缺少场景报价：${route.id}`);
        return {
          ...route,
          ...plan,
          cost: plan.cost,
          unitCost: plan.cost / route.load,
        };
      });
    return {
      routes,
      capacity: routes.reduce((sum, route) => sum + route.capacity, 0),
      trucks: routes.reduce((sum, route) => sum + route.trucks, 0),
      routeGap: routes.reduce((sum, route) => sum + route.gap, 0),
    };
  }
  const dual = transport("dual"),
    west = transport("west");
  return {
    storeCount: stores.length,
    stores,
    monthly,
    rows,
    channels,
    stock: aggregateStock(stockRows),
    actualTotal: monthly.reduce((sum, row) => sum + (row.actual ?? 0), 0),
    forecastTotal: monthly.reduce((sum, row) => sum + (row.forecast ?? 0), 0),
    transport: {
      dual,
      west,
    },
  };
}
export type QueryResult = ReturnType<typeof queryAnalytics>;
