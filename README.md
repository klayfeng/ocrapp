# 🚀 合同OCR商业闭环系统 (Enterprise Contract OCR System)

> 一个集成了 **C端极速采集** 与 **B端深度治理** 的全链路商业级 OCR 解决方案。通过双引擎 AI 共识机制与人工审核闭环，实现高精度的合同关键信息结构化提取。

## 🌟 核心亮点

本项目不仅仅是一个简单的 OCR 工具，而是一个**数据生产与治理的闭环系统**：

1.  **双引擎共识机制 (Dual-Engine Consensus)**
    *   系统同时调用两套 AI 模型/提示词策略（Flash 极速版 vs Pro 深度版）对同一份合同进行“背靠背”识别。
    *   自动计算**共识率 (Consensus Rate)**，只有当两个引擎结果一致时才认为高可信，差异部分高亮提示，大幅降低误识率。

2.  **商业闭环学习 (Loop Learning)**
    *   **采集 -> 识别 -> 审计 -> 训练**：
    *   B端管理员对低共识率记录进行人工修正（Audit）。
    *   修正后的数据自动转化为**训练样本 (Training Samples)**。
    *   新的识别任务会自动注入最新的纠错样本作为上下文 (Few-Shot Learning)，让系统“越用越聪明”。

3.  **企业级前端架构**
    *   **任务队列系统**：支持多文件拖拽、连续拍照上传。前端实现 `Pending` -> `Compressing` -> `Uploading` -> `Extracting` 的精细化状态管理。
    *   **智能压缩**：客户端自适应压缩算法（基于 Canvas），在保证 OCR 清晰度的前提下极大降低带宽消耗和上传延迟。

4.  **可视化 ROI 配置**
    *   提供无代码的 **ROI (Region of Interest) 标注工作台**。
    *   管理员可在底图上所见即所得地框选识别区域，动态调整字段定义，配置实时同步至云端，无需重新发版即可调整识别策略。

## 🧩 功能模块

### 📱 C端：智能采集前台 (`/`)
面向一线业务人员或最终用户，专注于极致的录入体验。
- **批量作业**：支持多图并发上传，自动加入任务队列。
- **实时反馈**：直观的进度条展示，实时计算并展示“共识率”。
- **历史档案**：本地/云端双向同步，支持查看历史识别记录、缩略图预览及关键字段摘要。
- **极速体验**：针对移动端优化的触摸交互与大按钮设计。

### 🛡️ B端：管理驾驶舱 (`/admin`)
面向审计人员与系统管理员，专注于数据质量与系统配置。
1.  **流水审计 (Stream Audit)**：
    *   全量识别记录的分页查询。
    *   基于共识率和状态（Pending/Done）的快速筛选。
2.  **深度核验 (Deep Audit)**：
    *   **高精图片查看器**：支持滚轮缩放、拖拽平移，方便核对细节。
    *   **差异对比**：同屏展示 Flash 引擎与 Pro 引擎的识别结果，一键采纳或手动修正。
    *   **入库训练**：提交修正结果，触发闭环学习。
3.  **ROI 标注 (ROI Config)**：
    *   Canvas 交互式绘图引擎。
    *   支持字段新增、删除、坐标微调、中文标签映射。
4.  **模型配置 (Model Config)**：
    *   支持动态切换底层大模型（如 Google Gemini, 火山引擎 Doubao 等）。
    *   自定义 API Endpoint 和 Key，无需改代码即可切换 AI 供应商。

## 🛠️ 技术栈

*   **前端框架**: React 19, TypeScript
*   **路由管理**: React Router DOM v7
*   **UI 系统**: Tailwind CSS (响应式设计, 移动端优先)
*   **数据存储**: Supabase (PostgreSQL + Storage)
*   **AI SDK**: @google/genai (支持标准 OpenAI 接口适配)
*   **构建工具**: ESBuild / Vite (inferred)

## 📂 核心文件结构

```text
/src
  ├── pages/
  │   ├── UserPage.tsx       # C端核心：队列处理、历史展示、任务调度
  │   ├── AdminDashboard.tsx # B端容器：权限控制、Tab切换
  │   ├── AdminRecordsPage.tsx # B端：审计列表与深度核验弹窗
  │   └── ROIPage.tsx        # B端：Canvas可视化标注工具
  ├── services/
  │   ├── ai.ts              # AI 调度层：Prompt工程、结果清洗、JSON修复
  │   ├── storage.ts         # 数据层：Supabase CRUD、Snake_case/CamelCase转换
  │   └── supabase.ts        # 客户端初始化
  ├── types.ts               # 全局类型定义 (UserRecord, QueuedTask, ROIConfig...)
  └── constants.ts           # 默认配置与ROI初始值
