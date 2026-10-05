import type { DecisionEvidence } from "./decision-evidence";

export type StoryCommand =
  | "/crisis-brief"
  | "/vessel-allocation"
  | "/delivery-plan"
  | "/arrival-execution"
  | "/daily-rebalance";

export type StoryStage =
  "crisis" | "allocation" | "delivery" | "execution" | "rebalance";

export type DemandCategory =
  | "enterprise"
  | "retail"
  | "premium"
  | "replenishment"
  | "mobile"
  | "contingency";

export type VehiclePool = "reserved" | "inventory";
export type VehicleStatus =
  | "at_sea"
  | "customs"
  | "pdi"
  | "ready"
  | "loaded"
  | "in_transit"
  | "delivered"
  | "at_vpc"
  | "exception";

export type RouteId =
  "west" | "riyadh" | "eastDirect" | "riyadhIntercept" | "dammamSafety";

export type VpcId = "JED" | "RUH" | "DMM";

export type VehicleUnit = {
  id: string;
  sequence: number;
  brand: "Toyota" | "Lexus";
  model: string;
  trim: string;
  color: string;
  pool: VehiclePool;
  demandCategory: DemandCategory;
  status: VehicleStatus;
  readyDay: number;
  dueDay: number | null;
  assignedDemandId?: string;
  destination?: string;
  targetVpc?: VpcId;
  route?: RouteId;
  batchId?: string;
};

export type DemandKind = "order" | "inventory";
export type Demand = {
  id: string;
  label: string;
  kind: DemandKind;
  category: DemandCategory;
  quantity: number;
  priority: number;
  destination: string;
  targetVpc?: VpcId;
  dueDay: number;
  marginTier: "standard" | "high" | "strategic";
};

export type Vpc = {
  id: VpcId;
  name: string;
  region: "west" | "central" | "east";
  openingStock: number;
  safetyStock: number;
};

export type CrisisAnalysis = {
  analyzedAt: string;
  dammamPortAvailable: false;
  vesselQuantity: number;
  reservedQuantity: number;
  inventoryQuantity: number;
  eastboundPressure: number;
  risks: Array<{ id: string; label: string; severity: "high" | "medium" }>;
  comparison: {
    legacy: string[];
    optimized: string[];
  };
};

export type ValidationIssue = {
  id: string;
  severity: "blocking" | "warning";
  message: string;
  vehicleIds?: string[];
};

export type AllocationAssignment = {
  vehicleId: string;
  demandId: string;
  pool: VehiclePool;
  destination: string;
  targetVpc?: VpcId;
  reason: string;
};

export type AllocationInput = {
  vpcWeights?: Partial<Record<VpcId, number>>;
  reserveProtected?: boolean;
  dammamSafetyStock?: number;
};

export type AllocationPlan = {
  id: string;
  version: number;
  createdAt: string;
  assignments: AllocationAssignment[];
  issues: ValidationIssue[];
  status: "draft" | "ready" | "stale" | "blocked";
  publishedAt?: string;
};

export type DeliveryInput = {
  maxWaitDays?: number;
  allowExternal?: boolean;
  routeCapacity?: Partial<Record<RouteId, number>>;
};

export type DeliveryAssignment = {
  vehicleId: string;
  route: RouteId;
  batchId: string;
  releaseDay: number;
  arrivalDay: number;
  handlingCount: number;
};

export type DeliveryBatch = {
  id: string;
  route: RouteId;
  vehicleIds: string[];
  departDay: number;
  arrivalDay: number;
  capacity: number;
  cost: number;
  status: "planned" | "released" | "shipped" | "received" | "cancelled";
};

export type DeliveryPlan = {
  id: string;
  allocationId: string;
  createdAt: string;
  assignments: DeliveryAssignment[];
  batches: DeliveryBatch[];
  issues: ValidationIssue[];
  status: "draft" | "ready" | "stale" | "blocked" | "published";
  publishedAt?: string;
};

export type ExecutionEvent =
  | { id: string; type: "arrive"; day: number }
  | { id: string; type: "clear" | "pdi"; day: number; vehicleIds: string[] }
  | {
      id: string;
      type: "ship" | "receive" | "cancel";
      day: number;
      batchId: string;
    };

export type ExecutionRecord = {
  events: ExecutionEvent[];
  vesselArrived: boolean;
  closedAt: string | null;
  blockers: ValidationIssue[];
};

export type ExecutionTotals = {
  total: number;
  atSea: number;
  customs: number;
  pdi: number;
  ready: number;
  loaded: number;
  inTransit: number;
  delivered: number;
  atVpc: number;
  exception: number;
  terminal: number;
};

export type InventoryPosition = {
  vehicleId: string;
  location: string;
  vpcId?: VpcId;
  status: "available" | "locked" | "delivered";
};

export type InventoryBaseline = {
  createdAt: string;
  positions: InventoryPosition[];
  vpcQuantity: number;
  deliveredOrderQuantity: number;
};

export type DailyOrderType = "enterprise" | "premium" | "retail" | "remote";
export type DailyOrder = {
  id: string;
  businessDate: string;
  type: DailyOrderType;
  model: string;
  quantity: number;
  destination: string;
  dueInDays: number;
  margin: number;
};

export type SourceCandidate = {
  id: string;
  orderId: string;
  sourceType: "local_vpc" | "nearby_vpc" | "store" | "dealer" | "next_vessel";
  location: string;
  vehicleIds: string[];
  cost: number;
  leadDays: number;
  sourceCoverBefore: number;
  sourceCoverAfter: number;
  ownershipConfirmed: boolean;
  executable: boolean;
  profitImpact: number;
  unmetConditions: string[];
  reason: string;
};

export type DailyDecision = {
  id: string;
  orderId: string;
  recommendedCandidateIds: string[];
  alternativeCandidateIds: string[];
  status: "proposed" | "approval_required" | "approved" | "rejected";
  rationale: string;
};

export type DailyExecutionTask = {
  id: string;
  decisionId: string;
  orderId: string;
  sourceCandidateId: string;
  vehicleIds: string[];
  status: "released" | "in_transit" | "received";
};

export type DailyPlan = {
  id: string;
  businessDate: string;
  orders: DailyOrder[];
  candidates: SourceCandidate[];
  decisions: DailyDecision[];
  executionTasks: DailyExecutionTask[];
  status: "draft" | "ready" | "executing" | "complete";
};

export type StoryEvent = {
  id: string;
  role: "thinking" | "data" | "validation" | "analysis" | "agent";
  title: string;
  detail: string;
  duration: number;
  operation?: string;
  sources?: string[];
};

export type StoryBlockStatus =
  "queued" | "streaming" | "ready" | "action_required" | "stale" | "error";

export type StoryBlock = {
  id: string;
  type: string;
  title: string;
  status: StoryBlockStatus;
  skillRunId: string;
  inputVersion: number;
  revealAt: number;
  data: Record<string, unknown>;
  interactions: string[];
  sourceRefs: string[];
};

export type StoryRunStatus =
  | "ready"
  | "running"
  | "paused"
  | "waiting_for_decision"
  | "complete"
  | "blocked";

export type StoryRun = {
  id: string;
  command: StoryCommand;
  prompt: string;
  businessDate: string;
  inputVersion: number;
  status: StoryRunStatus;
  elapsed: number;
  duration: number;
  events: StoryEvent[];
  blocks: StoryBlock[];
  decisions: string[];
  resultVersion: number | null;
  nextSkillSuggestions: StoryCommand[];
  answer?: string;
  blockedReason?: string;
  evidence?: DecisionEvidence;
};

export type AuditEntry = {
  id: string;
  at: string;
  action: string;
  detail: string;
};

export type CampaignState = {
  schemaVersion: 1;
  version: number;
  phase: "pre_arrival" | "arrival" | "daily";
  planningParameters: {
    dammamSafetyStock: number;
  };
  vessel: {
    id: string;
    name: string;
    eta: string;
    port: "Jeddah";
    vehicles: VehicleUnit[];
  };
  demand: Demand[];
  vpcs: Vpc[];
  crisis: CrisisAnalysis | null;
  allocation: AllocationPlan | null;
  deliveryPlan: DeliveryPlan | null;
  arrivalExecution: ExecutionRecord;
  inventoryBaseline: InventoryBaseline | null;
  dailyOrders: DailyOrder[];
  dailyOperations: DailyPlan[];
  auditTrail: AuditEntry[];
  runs: StoryRun[];
  activeRunId: string | null;
};

export type CampaignAction =
  | { type: "set_crisis"; analysis: CrisisAnalysis }
  | { type: "set_allocation"; plan: AllocationPlan }
  | { type: "set_delivery"; plan: DeliveryPlan }
  | { type: "execution_event"; event: ExecutionEvent }
  | { type: "set_inventory_baseline"; baseline: InventoryBaseline }
  | { type: "save_daily_plan"; plan: DailyPlan }
  | { type: "save_run"; run: StoryRun }
  | { type: "update_run"; run: StoryRun };
