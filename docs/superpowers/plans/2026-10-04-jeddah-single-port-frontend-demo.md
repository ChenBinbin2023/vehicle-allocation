# 吉达单港供应链 Agent 前端 Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `frontend/` 完全重构为由五个 CUI Skill 串联、GUI Block 同步流式生成的吉达单港供应链 Demo。

**Architecture:** 保留现有 Next.js 静态导出、三栏外壳、Session、IndexedDB 和 CUI 视觉组件；以新的 `CampaignState`、五个纯业务引擎和统一 Skill Runner 替换旧 allocation、logistics、strategy 与 domain 业务层。所有 Skill 运行生成不可变快照，GUI 只渲染已显示的 Block，第一阶段完成后生成的库存基线成为每日调拨的唯一初始输入。

**Tech Stack:** Next.js 16.2 App Router、React 19.2、TypeScript 5.9、Node test runner via `tsx --test`、Playwright 1.58、CSS、IndexedDB。

**Spec:** `docs/superpowers/specs/2026-10-04-jeddah-single-port-frontend-demo-design.md`

## Global Constraints

- 所有产品代码修改仅发生在 `frontend/`；设计与计划保存在 `docs/superpowers/`。
- 先阅读 `frontend/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`、`01-app/02-guides/static-exports.md` 和 `01-app/02-guides/testing/playwright.md`，遵循本项目实际安装的 Next.js 16.2 文档。
- 保持 `output: "export"`，不得引入服务器运行时、数据库、API Key、在线字体或在线地图。
- 界面只保留五个 Skill：`/crisis-brief`、`/vessel-allocation`、`/delivery-plan`、`/arrival-execution`、`/daily-rebalance`。
- 所有业务阶段必须从 CUI 发起；左侧进度和 GUI 控件不能启动下一 Skill。
- 需求维度和运输维度都必须对同一组 1,800 个模拟 VIN 守恒。
- 旧业务导航、旧 Skill、教学算例和旧故事数据不得保留隐藏入口。
- 保留灰白三栏布局、绿色主色、琥珀风险色、Session 隔离、IndexedDB 恢复和响应式布局。
- 当前工作区没有 Git 仓库；不得自行初始化 Git。各任务的提交步骤在 Git 不可用时改为记录验证结果和变更文件。

## Review Focus

- 用户手动输入尚未解锁的 Skill：CUI 应解释缺少的前置条件，且 Campaign 状态和 GUI 不变化；由 Task 6 测试。
- 刷新时存在运行中的 Skill：恢复后必须变成 paused，已显示 Block 保留且不重复；由 Task 7 测试。
- 用户修改影响结果的参数后查看旧版本：旧运行仍可回看，但不能发布或继续执行；由 Task 6 和 Task 9 测试。
- 同一 VIN 被两个需求或两次签收引用：发布应阻断，签收应按事件 ID 去重；由 Task 2 和 Task 4 测试。
- 授权车商有库存但权属未确认：只能显示为候选，不能生成可执行回购任务；由 Task 5 测试。

---

## File Structure

### 新业务层

- `frontend/src/lib/story/types.ts`：共享业务类型、Skill 类型和事件联合类型。
- `frontend/src/lib/story/seed.ts`：确定性的 1,800 VIN、订单、VPC、路线、板车和每日订单模拟数据。
- `frontend/src/lib/story/state.ts`：`CampaignState` 初始化、恢复、版本和失效规则。
- `frontend/src/lib/story/crisis-engine.ts`：单港影响分析。
- `frontend/src/lib/story/allocation-engine.ts`：订单池与库存补充池分配。
- `frontend/src/lib/story/delivery-engine.ts`：五条运输方向、配载、容量校验和回压。
- `frontend/src/lib/story/execution-engine.ts`：到港、清关、PDI、发运、签收、局部重排和库存基线。
- `frontend/src/lib/story/rebalance-engine.ts`：每日订单找车、调拨、回购和来源端保护。
- `frontend/src/lib/story/skill-catalog.ts`：五个 Skill 的文案、前置条件和 GUI Block 定义。
- `frontend/src/lib/story/skill-runner.ts`：CUI 事件与 GUI Block 同步推进。

### 新组件层

- `frontend/src/components/story/StoryWorkspace.tsx`：当前 Session 的故事编排和三栏内容。
- `frontend/src/components/story/StoryProgress.tsx`：只读阶段进度与历史运行入口。
- `frontend/src/components/story/StoryChat.tsx`：斜杠菜单、提示词、流式轨迹、暂停和继续。
- `frontend/src/components/story/StreamingCanvas.tsx`：按运行进度展示 GUI Block。
- `frontend/src/components/story/blocks/CrisisBlocks.tsx`：Skill 1 Block。
- `frontend/src/components/story/blocks/AllocationBlocks.tsx`：Skill 2 Block。
- `frontend/src/components/story/blocks/DeliveryBlocks.tsx`：Skill 3 Block。
- `frontend/src/components/story/blocks/ExecutionBlocks.tsx`：Skill 4 Block。
- `frontend/src/components/story/blocks/RebalanceBlocks.tsx`：Skill 5 Block。
- `frontend/src/components/story/shared.tsx`：故事专用但跨阶段复用的指标、状态、路线和表格组件。
- `frontend/src/styles/story.css`：新故事 GUI 样式和响应式规则。

### 修改通用层

- `frontend/src/lib/sessions.ts`：升级为 v3 Session 快照，只持有新故事状态。
- `frontend/src/lib/workspace-storage.ts`：切换到新的存储 key，保留 IndexedDB 读写。
- `frontend/src/components/SessionHost.tsx`：新左侧栏、Session 管理和 `StoryWorkspace` 挂载。
- `frontend/src/app/layout.tsx`：只加载通用样式和 `story.css`，更新 metadata。
- `frontend/src/styles/alpha-shell.css`、`frontend/src/styles/alpha-cui.css`、`frontend/src/styles/workspace.css`：保留三栏与 CUI 规则，删除旧业务专用选择器。
- `frontend/README.md`：改写为新五 Skill 故事、启动方式和验证说明。

### 删除旧业务层

- `frontend/src/lib/domain.ts`
- `frontend/src/lib/strategy.ts`
- `frontend/src/lib/strategy-command.ts`
- `frontend/src/lib/skills.ts`
- `frontend/src/lib/allocation/`
- `frontend/src/lib/logistics/`
- `frontend/src/components/Overview.tsx`
- `frontend/src/components/Operations.tsx`
- `frontend/src/components/PlanningSamples.tsx`
- `frontend/src/components/SkillCanvas.tsx`
- `frontend/src/components/Workspace.tsx`
- `frontend/src/components/Chat.tsx`
- `frontend/src/components/allocation/`
- `frontend/src/components/logistics/`
- `frontend/src/components/strategy/`
- `frontend/src/styles/allocation.css`
- `frontend/src/styles/logistics.css`
- `frontend/src/styles/strategy.css`
- 旧故事专用测试；待新测试覆盖相同行为后再删除。

---

### Task 1: 建立故事类型和确定性模拟数据

**Files:**
- Create: `frontend/src/lib/story/types.ts`
- Create: `frontend/src/lib/story/seed.ts`
- Create: `frontend/src/lib/story/state.ts`
- Test: `frontend/tests/story-seed.test.ts`

**Interfaces:**
- Produces: `createCampaignState(): CampaignState`
- Produces: `restoreCampaignState(value: unknown): CampaignState`
- Produces: `VehicleUnit`, `Demand`, `CampaignState`, `StoryRun`, `StoryBlock`, `StoryCommand`, `CampaignAction`

- [ ] **Step 1: 阅读项目安装版本的 Next.js 客户端组件、静态导出和 Playwright 指南**

Run: `sed -n '1,240p' node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md && sed -n '1,240p' node_modules/next/dist/docs/01-app/02-guides/static-exports.md && sed -n '1,220p' node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`

Expected: 明确交互组件使用客户端边界、静态导出不依赖服务器能力、Playwright 由现有 webServer 启动。

- [ ] **Step 2: 写入失败的种子守恒测试**

```ts
test("creates one deterministic 1800 VIN campaign", () => {
  const state = createCampaignState();
  assert.equal(state.vessel.vehicles.length, 1800);
  assert.equal(new Set(state.vessel.vehicles.map((v) => v.id)).size, 1800);
  assert.equal(countPool(state, "reserved"), 620);
  assert.equal(countPool(state, "inventory"), 1180);
});
```

- [ ] **Step 3: 运行测试并确认因故事模块不存在而失败**

Run: `npm test -- --test-name-pattern="deterministic 1800"`

Expected: FAIL，提示无法导入 `@/lib/story/seed` 或函数不存在。

- [ ] **Step 4: 实现最小类型、种子和状态恢复**

实现 `createCampaignState()`，使用稳定序号生成 `DEMO-VIN-0001` 至 `DEMO-VIN-1800`；订单池固定为 240 企业、290 普通零售、90 高配高利润，库存池固定为 780 补货、300 机动、100 异常缓冲。`restoreCampaignState()` 对非法值返回全新状态，对 running 运行恢复为 paused。

- [ ] **Step 5: 运行种子测试**

Run: `npm test -- --test-name-pattern="deterministic 1800"`

Expected: PASS。

- [ ] **Step 6: 任务检查点**

记录变更文件和测试输出；若执行时已有 Git 仓库，提交 `feat: add single-port campaign model`。

### Task 2: 实现单港影响和船次分车引擎

**Files:**
- Create: `frontend/src/lib/story/crisis-engine.ts`
- Create: `frontend/src/lib/story/allocation-engine.ts`
- Test: `frontend/tests/story-allocation.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `VehicleUnit`, `Demand`
- Produces: `analyzeCrisis(state: CampaignState): CrisisAnalysis`
- Produces: `allocateVessel(state: CampaignState, input?: AllocationInput): AllocationPlan`
- Produces: `validateAllocation(plan: AllocationPlan): ValidationIssue[]`

- [ ] **Step 1: 写入失败的危机和分车测试**

测试名称和断言：

- `identifies Dammam closure and eastbound pressure`：`dammamPortAvailable === false`，并包含旧路线绕行风险。
- `allocates every VIN once`：分配数量 1,800，VIN 集合大小 1,800。
- `preserves reserved and inventory pools`：620 和 1,180 守恒。
- `rejects duplicate VIN assignments`：重复 VIN 返回 blocking issue。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --test-name-pattern="Dammam closure|every VIN|reserved and inventory|duplicate VIN"`

Expected: FAIL，缺少引擎实现。

- [ ] **Step 3: 实现 `analyzeCrisis` 和 `allocateVessel`**

分车顺序固定为冻结不可用车辆、企业订单、普通已付款订单、高配高利润订单、VPC 补货、机动量和异常缓冲。`validateAllocation` 检查总量、唯一 VIN、有效需求和 VPC 目的地。

- [ ] **Step 4: 运行分车测试**

Run: `npm test -- --test-name-pattern="Dammam closure|every VIN|reserved and inventory|duplicate VIN"`

Expected: PASS。

- [ ] **Step 5: 任务检查点**

记录测试输出；若有 Git，提交 `feat: add crisis and vessel allocation engines`。

### Task 3: 实现单港运输计划和物流回压

**Files:**
- Create: `frontend/src/lib/story/delivery-engine.ts`
- Test: `frontend/tests/story-delivery.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `AllocationPlan`
- Produces: `planDelivery(state: CampaignState, input?: DeliveryInput): DeliveryPlan`
- Produces: `validateDelivery(plan: DeliveryPlan): ValidationIssue[]`
- Produces: `markAllocationFromDelivery(plan: AllocationPlan, delivery: DeliveryPlan): AllocationPlan`

- [ ] **Step 1: 写入失败的路线和容量测试**

```ts
assert.deepEqual(routeCounts(plan), {
  west: 520,
  riyadh: 650,
  eastDirect: 360,
  riyadhIntercept: 170,
  dammamSafety: 100,
});
assert.equal(plan.assignments.length, 1800);
```

同时测试东部明确订单优先直达、过渡带经利雅得截流、容量不足生成 blocker 并将低优先补货标为待调整。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --test-name-pattern="five single-port routes|east orders direct|capacity blocker"`

Expected: FAIL。

- [ ] **Step 3: 实现运输计划、板车批次和回压接口**

采用确定性的演示配载，保存每个 VIN 的 route、batchId、releaseDay、arrivalDay 和 handlingCount。容量不足不删除车辆，只产生 blocker 和受影响列表。

- [ ] **Step 4: 运行运输测试**

Run: `npm test -- --test-name-pattern="five single-port routes|east orders direct|capacity blocker"`

Expected: PASS。

- [ ] **Step 5: 任务检查点**

若有 Git，提交 `feat: add single-port delivery planning`。

### Task 4: 实现到港执行和库存基线

**Files:**
- Create: `frontend/src/lib/story/execution-engine.ts`
- Test: `frontend/tests/story-execution.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `DeliveryPlan`
- Produces: `applyExecutionEvent(state: CampaignState, event: ExecutionEvent): CampaignState`
- Produces: `closeArrivalExecution(state: CampaignState): InventoryBaseline`
- Produces: `executionConservation(state: CampaignState): ExecutionTotals`

- [ ] **Step 1: 写入失败的执行状态测试**

覆盖到港、清关、PDI、装车、发运、签收；重复 receipt ID 不增加数量；未签收车辆阻止关闭；全部完成后订单车辆 620 台、库存基线 1,180 台，总量 1,800。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --test-name-pattern="arrival execution|duplicate receipt|inventory baseline"`

Expected: FAIL。

- [ ] **Step 3: 实现事件 reducer 和关闭条件**

`applyExecutionEvent` 为纯函数；局部重排只允许未发运批次；`closeArrivalExecution` 仅在所有车辆有终态且无 blocker 时生成三大 VPC 库存基线。

- [ ] **Step 4: 运行执行测试**

Run: `npm test -- --test-name-pattern="arrival execution|duplicate receipt|inventory baseline"`

Expected: PASS。

- [ ] **Step 5: 任务检查点**

若有 Git，提交 `feat: add arrival execution state machine`。

### Task 5: 实现每日订单调拨和回购引擎

**Files:**
- Create: `frontend/src/lib/story/rebalance-engine.ts`
- Test: `frontend/tests/story-rebalance.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `InventoryBaseline`, `DailyOrder[]`
- Produces: `rebalanceDailyOrders(state: CampaignState, businessDate: string): DailyPlan`
- Produces: `approveDailyDecision(state: CampaignState, decisionId: string): CampaignState`

- [ ] **Step 1: 写入失败的日调拨测试**

覆盖：本地 VPC 优先、邻近 VPC、门店安全水位、企业大单组合车源、高利润订单低干扰调拨、普通订单不生成亏损专车、偏远地区拼单、授权库存未确认权属时不可执行。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --test-name-pattern="daily rebalance|source store safety|buyback ownership"`

Expected: FAIL。

- [ ] **Step 3: 实现候选排序和审批状态**

候选顺序为本地 VPC、邻近 VPC、同城门店、其他安全库存、授权车商、下一船。每个方案保存成本、时效、利润影响、来源端覆盖变化和未满足条件。

- [ ] **Step 4: 运行日调拨测试**

Run: `npm test -- --test-name-pattern="daily rebalance|source store safety|buyback ownership"`

Expected: PASS。

- [ ] **Step 5: 任务检查点**

若有 Git，提交 `feat: add daily rebalance and buyback engine`。

### Task 6: 建立五 Skill 目录和同步流式 Runner

**Files:**
- Create: `frontend/src/lib/story/skill-catalog.ts`
- Create: `frontend/src/lib/story/skill-runner.ts`
- Test: `frontend/tests/story-skills.test.ts`

**Interfaces:**
- Consumes: 五个业务引擎和 `CampaignState`
- Produces: `storySkills: StorySkill[]`
- Produces: `resolveStorySkill(input: string): StorySkill | undefined`
- Produces: `skillAvailability(command: StoryCommand, state: CampaignState): SkillAvailability`
- Produces: `startStoryRun(command: StoryCommand, prompt: string, state: CampaignState): StoryRun`
- Produces: `advanceStoryRun(run: StoryRun, milliseconds: number): StoryRun`
- Produces: `visibleStoryBlocks(run: StoryRun): StoryBlock[]`

- [ ] **Step 1: 写入失败的 Skill 测试**

断言目录恰好包含五个命令；前置条件按规格解锁；选择 Skill 只返回 prompt，不改变状态；`startStoryRun` 才创建运行；每个 CUI 阶段解锁对应 GUI Block；非法前置条件返回解释且状态不变；输入版本变化将旧结果标为 stale。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --test-name-pattern="five story skills|skill prerequisites|synchronized blocks|stale run"`

Expected: FAIL。

- [ ] **Step 3: 实现目录、可用性和 Runner**

每个 Skill 保存默认提示词、事件序列、Block 类型和下一步建议。`advanceStoryRun` 只推进时间和显示状态，不重复调用业务引擎。

- [ ] **Step 4: 运行 Skill 测试**

Run: `npm test -- --test-name-pattern="five story skills|skill prerequisites|synchronized blocks|stale run"`

Expected: PASS。

- [ ] **Step 5: 任务检查点**

若有 Git，提交 `feat: add synchronized story skill runner`。

### Task 7: 升级 Session 和 IndexedDB 快照

**Files:**
- Modify: `frontend/src/lib/sessions.ts:1-161`
- Modify: `frontend/src/lib/workspace-storage.ts:1-52`
- Test: `frontend/tests/story-sessions.test.ts`

**Interfaces:**
- Consumes: `CampaignState`, `StoryRun`, CUI `Message`
- Produces: `SessionSnapshot` v3、`freshSnapshot()`、`createWorkspace()`、`restoreWorkspace()`

- [ ] **Step 1: 写入失败的 v3 Session 测试**

测试全新 Session 使用“吉达单港供应保障”命名和空故事状态；不同 Session 隔离；v3 正常恢复；running 变 paused；旧 v2 快照不迁移旧业务，直接创建干净 v3；无效 JSON 回退到 fresh workspace。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --test-name-pattern="v3 workspace|pauses active story run|drops legacy story"`

Expected: FAIL。

- [ ] **Step 3: 实现 v3 快照和新存储 key**

使用 `atlas-single-port-workspace-v3`。删除 snapshot 中 month、scenario、strategy、allocation、logistics 和旧 domain state，只保存 campaign、runs、activeRunId、messages、draft、canvasMode 和 activeStage。

- [ ] **Step 4: 运行 Session 测试**

Run: `npm test -- --test-name-pattern="v3 workspace|pauses active story run|drops legacy story"`

Expected: PASS。

- [ ] **Step 5: 任务检查点**

若有 Git，提交 `refactor: replace workspace snapshot with story v3`。

### Task 8: 重建三栏壳、左侧进度和 CUI

**Files:**
- Create: `frontend/src/components/story/StoryWorkspace.tsx`
- Create: `frontend/src/components/story/StoryProgress.tsx`
- Create: `frontend/src/components/story/StoryChat.tsx`
- Create: `frontend/src/components/story/StreamingCanvas.tsx`
- Modify: `frontend/src/components/SessionHost.tsx:20-463`
- Test: `frontend/tests/story-shell.spec.ts`

**Interfaces:**
- Consumes: Task 6 Runner、Task 7 SessionSnapshot
- Produces: 完整三栏交互、`onSnapshot(id, snapshot)` 持久化回调

- [ ] **Step 1: 写入失败的浏览器壳测试**

测试初始页没有旧业务导航；左侧显示五段进度；点击未开始阶段不运行；输入 `/` 显示五个 Skill；选择 `/crisis-brief` 只填充提示词；按回车后才创建运行和首个 CUI 事件。

- [ ] **Step 2: 运行壳测试并确认失败**

Run: `npx playwright test tests/story-shell.spec.ts`

Expected: FAIL，仍显示旧导航或找不到新 Skill。

- [ ] **Step 3: 实现新壳和 CUI**

复用现有 `AlphaMarkdown`、通用 UI 和 `alpha-cui.css` 类名。左侧阶段按钮只切换已存在的运行快照。CUI 保留键盘选择、Shift+Enter、暂停、继续和自动跟随。

- [ ] **Step 4: 运行壳测试**

Run: `npx playwright test tests/story-shell.spec.ts`

Expected: PASS。

- [ ] **Step 5: 任务检查点**

若有 Git，提交 `feat: rebuild shell around CUI story skills`。

### Task 9: 实现第一阶段四个 Skill 的 GUI Block

**Files:**
- Create: `frontend/src/components/story/shared.tsx`
- Create: `frontend/src/components/story/blocks/CrisisBlocks.tsx`
- Create: `frontend/src/components/story/blocks/AllocationBlocks.tsx`
- Create: `frontend/src/components/story/blocks/DeliveryBlocks.tsx`
- Create: `frontend/src/components/story/blocks/ExecutionBlocks.tsx`
- Modify: `frontend/src/components/story/StreamingCanvas.tsx`
- Test: `frontend/tests/story-phase-one.spec.ts`

**Interfaces:**
- Consumes: `StoryBlock`, `CampaignState` 和当前不可变 `StoryRun`
- Produces: 每个 Block 的可视化和当前阶段内的筛选、下钻、参数与确认事件

- [ ] **Step 1: 写入失败的第一阶段端到端测试**

使用 Playwright Clock 推进时间，依次运行前四个 Skill。断言 GUI Block 数量随 CUI 阶段增长；分车显示 620/1,180；路线显示 520/650/360/170/100；联合计划发布后解锁到港执行；1,800 台完成后出现 1,180 台库存基线。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx playwright test tests/story-phase-one.spec.ts`

Expected: FAIL，Block 组件尚未实现。

- [ ] **Step 3: 实现 Crisis 和 Allocation Block**

实现倒计时、车型结构、单港对比、订单池、库存池、VPC 分配、区域覆盖、VIN 明细和待审批列表。筛选和展开不改变输入版本；参数修改触发 stale。

- [ ] **Step 4: 实现 Delivery 和 Execution Block**

实现五方向路线、板车配载、成本时效、回压、发布检查、T0–T+3 时间轴、清关/PDI、班次、在途、到货、异常、守恒和库存基线。

- [ ] **Step 5: 运行第一阶段测试**

Run: `npx playwright test tests/story-phase-one.spec.ts`

Expected: PASS。

- [ ] **Step 6: 任务检查点**

若有 Git，提交 `feat: add streamed phase-one story canvases`。

### Task 10: 实现每日调拨 GUI 和审批交互

**Files:**
- Create: `frontend/src/components/story/blocks/RebalanceBlocks.tsx`
- Modify: `frontend/src/components/story/StreamingCanvas.tsx`
- Test: `frontend/tests/story-daily-rebalance.spec.ts`

**Interfaces:**
- Consumes: `DailyPlan`、库存基线和 `approveDailyDecision`
- Produces: 可重复运行的经营日工作台和更新后的库存/审计状态

- [ ] **Step 1: 写入失败的每日调拨浏览器测试**

断言第一阶段完成前命令被阻止；完成后展示订单池、VPC 发货、候选网络、企业集结、高利润调拨、普通订单建议、偏远拼单、源店影响、回购条件和审批；未确认权属时回购按钮禁用；批准后生成运输任务并更新库存。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx playwright test tests/story-daily-rebalance.spec.ts`

Expected: FAIL。

- [ ] **Step 3: 实现 Rebalance Block 和审批事件**

每个订单决策卡显示推荐、备选、成本、交期、利润、来源端影响和待确认条件。下一经营日生成新运行，不覆盖前一日快照。

- [ ] **Step 4: 运行每日调拨测试**

Run: `npx playwright test tests/story-daily-rebalance.spec.ts`

Expected: PASS。

- [ ] **Step 5: 任务检查点**

若有 Git，提交 `feat: add daily rebalance story canvas`。

### Task 11: 删除旧故事并完成视觉与文档收口

**Files:**
- Create: `frontend/src/styles/story.css`
- Modify: `frontend/src/app/layout.tsx:1-20`
- Modify: `frontend/src/styles/alpha-shell.css`
- Modify: `frontend/src/styles/alpha-cui.css`
- Modify: `frontend/src/styles/workspace.css`
- Modify: `frontend/README.md`
- Delete: File Structure 中列出的全部旧业务文件和旧业务测试
- Test: `frontend/tests/story-cleanup.test.ts`

**Interfaces:**
- Consumes: Tasks 1–10 的新业务和 UI
- Produces: 无旧业务引用的可构建静态应用

- [ ] **Step 1: 写入失败的清理测试**

测试 Skill 目录只含五个命令；Session 快照不含旧字段；渲染文案不含“周度分货”“教学算例”“周末复盘”；layout 不再导入 allocation、strategy、logistics CSS。

- [ ] **Step 2: 运行清理测试并确认失败**

Run: `npm test -- --test-name-pattern="contains only the new story"`

Expected: FAIL，旧模块仍存在或被引用。

- [ ] **Step 3: 删除旧模块并修正全部引用**

先用 `codegraph impact` 或 `codegraph affected` 确认待删符号的剩余依赖；删除后运行 `codegraph sync`。保留被新组件实际使用的通用 `AlphaMarkdown`、`Drawers`、`ui` 和存储组件。

- [ ] **Step 4: 完成故事样式和响应式规则**

桌面保持约 292px 左栏、中间自适应、约 440px CUI；窄屏 CUI 使用右侧覆盖层；Block 保持顺序、状态点和进入动画，减少动态效果时遵循系统偏好。

- [ ] **Step 5: 更新 metadata 和 README**

README 只描述两个阶段、五个 Skill、演示顺序、模拟边界、启动和验证命令。

- [ ] **Step 6: 运行清理测试、类型检查和构建**

Run: `npm test && npm run typecheck && npm run build`

Expected: 所有命令 exit 0；静态输出生成到 `frontend/out/`。

- [ ] **Step 7: 任务检查点**

若有 Git，提交 `refactor: remove legacy supply-chain demo`。

### Task 12: 完整回归和视觉验收

**Files:**
- Modify: `frontend/tests/story-shell.spec.ts`
- Modify: `frontend/tests/story-phase-one.spec.ts`
- Modify: `frontend/tests/story-daily-rebalance.spec.ts`
- Create: `frontend/docs/new-story-desktop.png`
- Create: `frontend/docs/new-story-mobile.png`

**Interfaces:**
- Consumes: 完整应用
- Produces: 可复核的验证输出和最终截图

- [ ] **Step 1: 运行全部单元测试**

Run: `npm test`

Expected: 0 failures。

- [ ] **Step 2: 运行类型检查**

Run: `npm run typecheck`

Expected: 0 errors。

- [ ] **Step 3: 运行生产构建**

Run: `npm run build`

Expected: exit 0，静态导出成功。

- [ ] **Step 4: 运行全部浏览器测试**

Run: `npm run test:e2e`

Expected: 0 failures，覆盖完整五 Skill 流程、Session 恢复和移动布局。

- [ ] **Step 5: 捕获并检查桌面与移动截图**

使用 `frontend/scripts/inspect-ui.mjs` 或 Playwright 保存截图，再用图像查看工具检查三栏布局、Block 顺序、CUI 滚动、表格裁切、移动覆盖层和旧入口残留。

- [ ] **Step 6: 修复视觉问题并重新运行受影响测试**

Expected: 截图无重叠、溢出或不可读内容；新 Session 可完整演示五个 Skill。

- [ ] **Step 7: 最终检查点**

记录四条验证命令的实际输出和截图路径；若有 Git，提交 `test: verify single-port story demo`。
