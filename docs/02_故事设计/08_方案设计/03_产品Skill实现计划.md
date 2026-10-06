# 门店分车与到店物流 Product Skill Implementation Plan

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话逐项实现。

**Goal:** 将 `/vessel-allocation` 与 `/delivery-plan` 实现为产品内 CUI + GUI 模拟工作台。

**Architecture:** 使用独立、可计算的门店模拟模型，两个 Skill 共享不可变分车快照。CUI 展示计划、计算过程和结论，GUI 提供参数、明细和情景比较，每次重跑保存独立画布。

**Tech Stack:** 现有 Next.js 16、React 19、TypeScript、node:test、Playwright；不增加依赖。

**Spec:** 本目录 `01_订单优先与门店注水分车设计.md`、`02_到店交付与VPC路由设计.md`。

## Global Constraints

- 当前按门店 × 品牌颗粒度，预留车型配置扩展；已订订单优先；直营与授权按销售速度、可用库存、目标 WoS 注水。
- 门店有停车场仍受接车量限制，同店支持部分直送、部分 VPC 暂存及后续批次。
- 全部结果标记为模拟计划，不自动发布或记作实际签收。
- 保留当前智能问数及用户现有修改。

## Review Focus

- 供给不足时订单缺口显式展示，禁止负补库量或超分。
- 零销速门店不计算无穷 WoS，不强制消耗多余供给。
- 接车能力或 VPC 容量不足时展示待排程、未落实量，禁止虚构 ETA。
- 参数重跑保留旧画布，物流绑定所选分车版本。
- 移动端表格局部滚动，画布和 CUI 不撑宽页面。

### Task 1: 计算模型

**Files:** 新建 `frontend/src/lib/story/store-planning.ts`、`frontend/tests/store-planning.test.ts`。

**Interfaces:** `calculateStoreAllocation(input: AllocationScenario): StoreAllocation`；`calculateStoreDelivery(allocation: StoreAllocation, input: DeliveryScenario): StoreDelivery`。

- [x] 先写并运行失败测试：1800 台基准、1500/2000 台、订单不足、零销速、整数注水、同店直送与暂存、容量不足、单/双港成本及订单时效、独立 VPC 发运。
- [x] 实现上述函数及可编辑模拟数据，验证数量守恒和已确认数值。

### Task 2: 产品运行与画布

**Files:** 新建 `store-planning-run.ts`、`StorePlanningWorkspace.tsx`、`store-planning.css`；修改现有 Skill 注册、运行器、工作台和 CUI。

**Interfaces:** StoryRun 保存 `planning` 输入与计算结果；GUI 重跑通过 `onRunPlanning(command, input)` 进入现有 CUI，物流快照记录来源 run ID。

- [x] 先写失败集成测试：直接启动分车、物流前置条件、GUI 重跑使用指定参数、历史和刷新保留结果、模拟计划不自动发布。
- [x] 接入两个 Skill 的过程记录和结论，参数面板、门店表、WoS 水位图、路线拆分、单/双港比较、批次表及快照导出。

### Task 3: 验证

- [x] 运行全部单元测试、类型检查和生产构建。
- [x] 运行新工作台及智能问数浏览器测试，更新被新业务规则替代的旧故事断言。
- [x] 检查桌面和手机画布截图，确认无裁切、无运行错误。

## 首版完成记录（历史）

- 两个产品 Skill 已在现有 CUI / GUI 中运行；保存参数、分车引用、计算结果和历史画布。
- 验证：60/60 单元测试、21/21 浏览器测试、类型检查、生产构建和差异检查通过；桌面及移动截图已检查。
- 独立复核发现 VPC 容量为零时的子集统计及暂停期间的重跑状态问题，均以失败回归测试定位并修复。
- 当前实现范围为四家代表门店、单一配置的模拟。真实 VIN、多配置和承运能力接入另行扩展，不自动产生真实执行记录。

## 数据与演示修订（2026-10-05）

- [x] 分车默认数据改为 `data` 的 79 家丰田 / 20 家雷克萨斯门店，品牌独立；原四店示例仅保留为手算回归测试。
- [x] 接入椭圆节点、直线依赖的 B1–B10 本体图谱，节点解释与 CUI 定位。
- [x] 接入按当前供给重新计算的分渠道竖柱注水演示，含进度、播放、步进、速度与渠道偏移。
- [x] 物流引用 data 的模拟路线与共享周运力；接车参数显式为情景假设，完整成本保持未知。
- [x] 数据口径、品牌切换、在途开关、订单优先、历史快照与移动端回归检查。

本节替代上一版“四家代表门店、单一配置”的产品实现范围；当前无 VIN/车型配置数据，暂不做逐 VIN 分配。

修订验证：67/67 单元测试、22/22 浏览器测试、类型检查、生产构建及差异检查通过；图谱、注水和移动端截图已核对。复核修正了注水取整导致数量回退、授权店编码解析、千分位订单数量截断及干线费用被误标为全链费用的问题。
