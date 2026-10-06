import {
  defaultQueryFilters,
  queryAnalytics,
  queryMetadata,
  queryMonths,
  queryRegions,
  queryStores,
} from "./query-engine";
import type { QueryFilters } from "./query-engine";
import type { CampaignState, StoryEvent, StoryRun } from "./types";

function parseQueryPrompt(prompt: string) {
  const filters = { ...defaultQueryFilters };
  const notices: string[] = [];
  const compactPrompt = prompt.replace(/\s/g, "");
  const regions = queryRegions.filter((region) => prompt.includes(region));
  if (regions.length && !/(各|全部|所有).*区域/.test(prompt))
    filters.region = regions.join(",");
  if (prompt.includes("直营") && !prompt.includes("授权"))
    filters.channel = "直营";
  if (prompt.includes("授权") && !prompt.includes("直营"))
    filters.channel = "二级展厅";
  if (prompt.includes("丰田") && !prompt.includes("雷克萨斯"))
    filters.brand = "丰田";
  if (prompt.includes("雷克萨斯") && !prompt.includes("丰田"))
    filters.brand = "雷克萨斯";
  const vpcs = [
    ["吉达", "JED"],
    ["利雅得", "RUH"],
    ["达曼", "DMM"],
  ].filter(([name]) => compactPrompt.includes(`${name}VPC`));
  if (vpcs.length) filters.vpc = vpcs.map(([, id]) => id).join(",");
  const stores = queryStores.filter(
    (item) =>
      compactPrompt.includes(item.id) ||
      compactPrompt.includes(item.name.replace(/^模拟/, "")),
  );
  if (stores.length) filters.store = stores.map((store) => store.id).join(",");
  const normalizeMonth = (year: string, month: string) =>
    Number(month) >= 1 && Number(month) <= 12
      ? `${year}-${month.padStart(2, "0")}`
      : null;
  const iso = [...prompt.matchAll(/(20\d{2})-(\d{1,2})(?!\d)/g)].map((match) =>
    normalizeMonth(match[1], match[2]),
  );
  const chinese = [
    ...prompt.matchAll(
      /(20\d{2})\s*年\s*(\d{1,2})\s*月(?:\s*(?:至|到|[-—~～])\s*(?:(20\d{2})\s*年\s*)?(\d{1,2})\s*月)?/g,
    ),
  ].flatMap((match) => [
    normalizeMonth(match[1], match[2]),
    ...(match[4] ? [normalizeMonth(match[3] ?? match[1], match[4])] : []),
  ]);
  const months = [...iso, ...chinese]
    .filter((month): month is string => month !== null)
    .sort();
  if (!months.length) {
    const years = [...prompt.matchAll(/(20\d{2})\s*年/g)]
      .map((match) => match[1])
      .sort();
    if (years.length) months.push(`${years[0]}-01`, `${years.at(-1)}-12`);
  }
  if (months.length) {
    const requestedFrom = months[0],
      requestedTo = months.at(-1)!;
    const first = queryMonths[0],
      last = queryMonths.at(-1)!;
    const overlaps = requestedTo >= first && requestedFrom <= last;
    filters.from = overlaps && requestedFrom < first ? first : requestedFrom;
    filters.to = overlaps && requestedTo > last ? last : requestedTo;
    if (!overlaps)
      notices.push(
        `请求期间没有可用月度数据；可用范围为 ${first} 至 ${last}，库存仍为 ${queryMetadata.stockDate} 快照。`,
      );
    else if (filters.from !== requestedFrom || filters.to !== requestedTo)
      notices.push(
        `请求期间超出可用范围，月度视图采用 ${filters.from} 至 ${filters.to}；范围外月份不补造数据。`,
      );
  }
  return { filters, notices };
}

export function queryFiltersFromPrompt(prompt: string): QueryFilters {
  return parseQueryPrompt(prompt).filters;
}

export function startQueryRun(
  id: string,
  prompt: string,
  state: CampaignState,
): StoryRun {
  const { filters, notices } = parseQueryPrompt(prompt);
  const result = queryAnalytics(filters);
  const number = (value: number) => value.toLocaleString("en-US");
  const summary = `已为 ${result.storeCount} 家门店生成销量与预测、库存与渠道、陆路运输成本三个视图。所选期间历史销量 ${number(result.actualTotal)} 台，模拟预测 ${number(result.forecastTotal)} 台；9 月 29 日实物库存 ${number(result.stock.physical)} 台，在途 ${number(result.stock.transit)} 台。\n\n全网周运力基准：双港口 3,226 台、吉达单港 1,865 台。8、9 月历史销量缺失，预测采用最近三个有效月的日均销量；运输页展示源数据中的路线报价与周运力，VPC 视图为服务门店汇总。销量可按总量、区域、VPC 或指定门店查看月度曲线。`;
  const events: Array<Omit<StoryEvent, "id">> = [
    {
      role: "thinking",
      title: "分析问数目标与数据范围",
      detail: `把问题拆成销量趋势、库存健康与陆路运费三个分析视图。\n采用范围：${filters.from} 至 ${filters.to}；${filters.region === "all" ? "全部区域" : filters.region}；${filters.vpc === "all" ? "全部 VPC" : filters.vpc}；${filters.store === "all" ? "全部匹配门店" : filters.store}；${filters.channel === "all" ? "直营与授权" : filters.channel}；${filters.brand === "all" ? "全部品牌" : filters.brand}。${notices.length ? `\n${notices.join("\n")}` : ""}`,
      duration: 700,
      operation: "思考",
    },
    {
      role: "plan",
      title: "执行计划",
      detail:
        "① 读取门店与月度销量，校验直营/授权汇总。\n② 关联库存快照、锁定、冻结、在途与库龄。\n③ 去重城市路线，比较双港口/单港运输情景。\n④ 生成三个 Tab 与可追溯的总结。",
      duration: 900,
      operation: "规划",
    },
    {
      role: "tool",
      title: "读取门店网络与月度销量",
      detail:
        "79 家门店、34 家直营、45 家授权 L2；读取 1,881 条门店 × 品牌 × 月份记录，保留有效历史月份。",
      duration: 1100,
      operation: "data.read · sales.aggregate",
      sources: ["00_客户/门店主数据.csv", "02_销速/月度门店销量.csv"],
      canvasTab: "sales",
    },
    {
      role: "thinking",
      title: "检查缺失月份，调整预测计划",
      detail:
        "历史数据截至 2026-07；8、9 月为空，不能补成零销量。单独计算 8—10 月模拟预测，并以虚线展示。",
      duration: 800,
      operation: "再次思考",
      canvasTab: "sales",
    },
    {
      role: "tool",
      title: "汇总销量并生成模拟预测",
      detail: `${queryMetadata.forecastRule}所选范围内历史销量 ${number(result.actualTotal)} 台；预测与历史分别汇总，预测不是已发生销量。`,
      duration: 1100,
      operation: "sales.groupBy · forecast.dailyMean",
      sources: ["02_销速/月度门店销量.csv", "01_供给/按月总表.csv"],
      canvasTab: "sales",
    },
    {
      role: "tool",
      title: "关联库存快照与渠道",
      detail: `实物 ${number(result.stock.physical)} 台 = 可用 ${number(result.stock.free)} + 锁定 ${number(result.stock.locked)} + 冻结 ${number(result.stock.frozen)}；在途 ${number(result.stock.transit)} 台单列。VPC 使用模拟服务关系汇总门店库存。`,
      duration: 1100,
      operation: "inventory.join · inventory.validate",
      sources: ["03_库存/当前库存_门店.csv", "02_销速/销速汇总_门店.csv"],
      canvasTab: "inventory",
    },
    {
      role: "thinking",
      title: "校验路线报价与共享运力",
      detail:
        "每条城市路线共用运力，只累计一次。使用源数据的整趟报价与 8 台满载单台费，按双港口与单港口场景比较。",
      duration: 800,
      operation: "成本口径校验",
      canvasTab: "transport",
    },
    {
      role: "tool",
      title: "计算陆路运输情景",
      detail: `所涉及路线的双港口周运力 ${number(result.transport.dual.capacity)} 台，单港口 ${number(result.transport.west.capacity)} 台。两种场景互斥，路线报价与固定周运力分列展示。`,
      duration: 1100,
      operation: "routes.deduplicate · transport.quotes",
      sources: [
        "04_运力/路线主数据.csv",
        "04_运力/门店路线映射.csv",
        "04_运力/场景路线运力.csv",
      ],
      canvasTab: "transport",
    },
    {
      role: "agent",
      title: "三个分析视图已生成",
      detail:
        "销量与预测、库存与渠道、陆路运输成本已同步到画布。切换 Tab 或点击过程中的查看按钮继续分析。",
      duration: 700,
      operation: "阶段总结",
    },
  ];
  return {
    id,
    command: "/smart-query",
    prompt,
    businessDate: "数据快照 · 2026-09-29",
    inputVersion: state.version,
    status: "running",
    elapsed: 0,
    duration: events.reduce((sum, event) => sum + event.duration, 0),
    events: events.map((event, index) => ({
      ...event,
      id: `${id}-EVENT-${index + 1}`,
    })),
    blocks: [
      ["sales", "销量与预测", 4600],
      ["inventory", "库存与渠道", 5700],
      ["transport", "陆路运输成本", 7600],
    ].map(([tab, title, revealAt], index) => ({
      id: `${id}-BLOCK-${index + 1}`,
      type: `query-${tab}`,
      title: String(title),
      revealAt: Number(revealAt),
      status: "queued",
      skillRunId: id,
      inputVersion: state.version,
      data: { tab, snapshot: queryMetadata.snapshot },
      interactions: ["筛选", "切换维度", "导出明细"],
      sourceRefs: [queryMetadata.snapshot],
    })),
    decisions: [],
    resultVersion: null,
    nextSkillSuggestions: ["/smart-query"],
    query: { filters, summary },
  };
}
