import type {
  CampaignState,
  DailyOrder,
  Demand,
  DemandCategory,
  VehiclePool,
  VehicleUnit,
} from "./types";

const categoryPlan: Array<{
  category: DemandCategory;
  pool: VehiclePool;
  quantity: number;
}> = [
  { category: "enterprise", pool: "reserved", quantity: 240 },
  { category: "retail", pool: "reserved", quantity: 290 },
  { category: "premium", pool: "reserved", quantity: 90 },
  { category: "replenishment", pool: "inventory", quantity: 780 },
  { category: "mobile", pool: "inventory", quantity: 300 },
  { category: "contingency", pool: "inventory", quantity: 100 },
];

const regularModels = ["Hilux", "Camry", "Yaris", "RAV4", "Land Cruiser"];
const premiumModels = ["Lexus LX", "Lexus RX", "Land Cruiser GR"];
const colors = ["White", "Black", "Silver", "Pearl"];

function vehicleModel(category: DemandCategory, index: number) {
  if (category === "enterprise") return index % 3 === 0 ? "Camry" : "Hilux";
  if (category === "premium") return premiumModels[index % premiumModels.length];
  return regularModels[index % regularModels.length];
}

function createVehicles(): VehicleUnit[] {
  const vehicles: VehicleUnit[] = [];
  let sequence = 1;
  for (const group of categoryPlan) {
    for (let i = 0; i < group.quantity; i += 1) {
      const model = vehicleModel(group.category, i);
      vehicles.push({
        id: `DEMO-VIN-${String(sequence).padStart(4, "0")}`,
        sequence,
        brand: model.startsWith("Lexus") ? "Lexus" : "Toyota",
        model,
        trim: group.category === "premium" ? "VIP" : i % 2 ? "Mid" : "Standard",
        color: colors[i % colors.length],
        pool: group.pool,
        demandCategory: group.category,
        status: "at_sea",
        readyDay: i < 1500 ? 1 : 2,
        dueDay: group.pool === "reserved" ? 3 : null,
      });
      sequence += 1;
    }
  }
  return vehicles;
}

const demand: Demand[] = [
  {
    id: "DEM-ENTERPRISE",
    label: "企业预订订单",
    kind: "order",
    category: "enterprise",
    quantity: 240,
    priority: 100,
    destination: "企业交付中心",
    dueDay: 3,
    marginTier: "strategic",
  },
  {
    id: "DEM-RETAIL",
    label: "已付款零售订单",
    kind: "order",
    category: "retail",
    quantity: 290,
    priority: 90,
    destination: "客户交付门店",
    dueDay: 3,
    marginTier: "standard",
  },
  {
    id: "DEM-PREMIUM",
    label: "高配及高利润订单",
    kind: "order",
    category: "premium",
    quantity: 90,
    priority: 95,
    destination: "高价值客户交付点",
    dueDay: 3,
    marginTier: "high",
  },
  {
    id: "DEM-REPLENISHMENT",
    label: "VPC明确补货",
    kind: "inventory",
    category: "replenishment",
    quantity: 780,
    priority: 60,
    destination: "VPC库存",
    dueDay: 3,
    marginTier: "standard",
  },
  {
    id: "DEM-MOBILE",
    label: "全国机动库存",
    kind: "inventory",
    category: "mobile",
    quantity: 300,
    priority: 50,
    destination: "中轴机动库存",
    dueDay: 3,
    marginTier: "standard",
  },
  {
    id: "DEM-CONTINGENCY",
    label: "港口异常缓冲",
    kind: "inventory",
    category: "contingency",
    quantity: 100,
    priority: 40,
    destination: "港口异常缓冲",
    dueDay: 3,
    marginTier: "standard",
  },
];

const dailyOrders: DailyOrder[] = [
  {
    id: "DAY4-ENT-001",
    businessDate: "T+4",
    type: "enterprise",
    model: "Hilux",
    quantity: 80,
    destination: "利雅得企业交付中心",
    dueInDays: 3,
    margin: 640000,
  },
  {
    id: "DAY4-LUX-001",
    businessDate: "T+4",
    type: "premium",
    model: "Lexus LX",
    quantity: 1,
    destination: "利雅得旗舰店",
    dueInDays: 1,
    margin: 48000,
  },
  {
    id: "DAY4-RET-001",
    businessDate: "T+4",
    type: "retail",
    model: "Camry",
    quantity: 1,
    destination: "达曼零售中心",
    dueInDays: 2,
    margin: 6200,
  },
  {
    id: "DAY4-REM-001",
    businessDate: "T+4",
    type: "remote",
    model: "Hilux",
    quantity: 8,
    destination: "塔布克区域交付点",
    dueInDays: 4,
    margin: 56000,
  },
];

export function createCampaignState(): CampaignState {
  return {
    schemaVersion: 1,
    version: 1,
    phase: "pre_arrival",
    planningParameters: { dammamSafetyStock: 100 },
    vessel: {
      id: "RO-RO-JED-2026-10",
      name: "JEDDAH HORIZON",
      eta: "T0",
      port: "Jeddah",
      vehicles: createVehicles(),
    },
    demand: demand.map((item) => ({ ...item })),
    vpcs: [
      { id: "JED", name: "吉达 VPC", region: "west", openingStock: 480, safetyStock: 360 },
      { id: "RUH", name: "利雅得 VPC", region: "central", openingStock: 390, safetyStock: 520 },
      { id: "DMM", name: "达曼 VPC", region: "east", openingStock: 210, safetyStock: 280 },
    ],
    crisis: null,
    allocation: null,
    deliveryPlan: null,
    arrivalExecution: {
      events: [],
      vesselArrived: false,
      closedAt: null,
      blockers: [],
    },
    inventoryBaseline: null,
    dailyOrders: dailyOrders.map((item) => ({ ...item })),
    dailyOperations: [],
    auditTrail: [],
    runs: [],
    activeRunId: null,
  };
}
