import type { AllocationScenario } from "../src/lib/story/store-planning";
export function fourStoreAllocation(): AllocationScenario {
  return {
    supply: 1800,
    targetDirect: 4,
    targetAuthorized: 4,
    sku: "统一车型配置 · 模拟",
    stores: [
      {
        id: "D1",
        name: "西部门店 D1",
        channel: "直营",
        orders: 300,
        weeklySales: 150,
        availableStock: 150,
        allocationCap: null,
        dueDay: 3,
      },
      {
        id: "D2",
        name: "中部门店 D2",
        channel: "直营",
        orders: 250,
        weeklySales: 100,
        availableStock: 200,
        allocationCap: null,
        dueDay: 5,
      },
      {
        id: "A1",
        name: "东部门店 A1",
        channel: "授权",
        orders: 200,
        weeklySales: 100,
        availableStock: 50,
        allocationCap: null,
        dueDay: 3,
      },
      {
        id: "A2",
        name: "北部门店 A2",
        channel: "授权",
        orders: 150,
        weeklySales: 50,
        availableStock: 250,
        allocationCap: null,
        dueDay: 7,
      },
    ],
  };
}
