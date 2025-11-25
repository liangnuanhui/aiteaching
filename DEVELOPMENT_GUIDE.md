# 开发指南 (Development Guide)

本文档记录项目的技术架构、开发规范和最佳实践。

---

## 📋 目录

1. [项目架构](#项目架构)
2. [Runtime 配置规则](#runtime-配置规则)
3. [开发前检查清单](#开发前检查清单)
4. [新功能开发流程](#新功能开发流程)
5. [常见陷阱与解决方案](#常见陷阱与解决方案)
6. [代码规范](#代码规范)

---

## 🏗️ 项目架构

### 技术栈

- **前端框架**: Next.js 15.5 + React 19
- **部署平台**: Cloudflare Pages
- **数据库**: Cloudflare D1 (SQLite)
- **存储**: Cloudflare R2 (S3兼容)
- **ORM**: Prisma
- **认证**: NextAuth v5
- **AI服务**: ModelScope API

### 关键特性

#### Edge Runtime vs Node.js Runtime

**重要：** 本项目为 Cloudflare Pages 部署而配置，默认使用 **edge runtime**。

**Global 配置** (`app/layout.tsx`):

```typescript
export const runtime = 'edge';
```

这意味着：

- ✅ 所有页面默认在 edge runtime 运行
- ❌ Edge runtime **不支持** 标准 Prisma Client
- ✅ 需要 Prisma 的页面必须显式声明 `runtime = 'nodejs'`

#### Prisma 限制

Prisma 需要 Node.js runtime，因为：

- Edge runtime 不支持 `better-sqlite3`
- Edge runtime 不支持文件系统操作
- 需要使用 Prisma Accelerate 或 Driver Adapters

**解决方案：** 所有使用 Prisma 的文件都必须添加：

```typescript
export const runtime = 'nodejs';
```

---

## ⚙️ Runtime 配置规则

### 何时使用 `runtime = 'nodejs'`

**必须使用的场景：**

1. **使用 Prisma 查询数据库**

   ```typescript
   // ✅ 正确
   export const runtime = 'nodejs';

   const prisma = createPrismaClient();
   ```

2. **使用 Node.js 专有 API**
   - `fs` (文件系统)
   - `path` (路径处理)
   - `crypto` (加密)
   - `child_process`

3. **调用需要 Node.js 的第三方库**
   - OCR 处理
   - 图片处理 (sharp)
   - PDF 生成 (docx)

### 何时使用 `runtime = 'edge'`

**适用场景：**

1. 简单的 API 路由（无数据库）
2. 静态内容返回
3. 重定向、代理等轻量操作
4. 需要低延迟的全球分发

### 检查方法

```bash
# 查看项目中所有 runtime 配置
grep -r "export const runtime" app/

# 查看特定目录
grep -r "export const runtime" app/api/
```

---

## ✅ 开发前检查清单

### 开始新功能前必做：

```bash
# 1. 检查全局 runtime 配置
cat app/layout.tsx | grep "runtime"

# 2. 查看现有类似页面的实现模式
ls app/lessons/[lessonId]/
cat app/lessons/[lessonId]/page.tsx | grep "runtime"

# 3. 了解项目部署配置
cat next.config.ts

# 4. 检查是否有相关文档
ls *.md
```

### 创建新文件时：

**页面 (Page) / API 路由:**

```typescript
/**
 * 描述这个页面/API的功能
 */

// 1. 导入语句
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';

// 2. Runtime 声明（如果使用 Prisma）
export const runtime = 'nodejs'; // ← 不要忘记！

// 3. 初始化
const prisma = createPrismaClient();

// 4. 导出函数
export default async function MyPage() {
  // ...
}
```

**检查点：**

- [ ] 是否使用 Prisma？→ 添加 `runtime = 'nodejs'`
- [ ] 是否使用 Node.js API？→ 添加 `runtime = 'nodejs'`
- [ ] 是否参考了现有类似文件的模式？
- [ ] 导入路径是否使用了 `@/` 别名？

---

## 🔄 新功能开发流程

### 推荐工作流

```
1. 📋 需求分析
   ├─ 明确功能需求
   ├─ 确定技术依赖（Prisma、外部API等）
   └─ 评估是否需要 Worker/后台任务

2. 🔍 项目调研（关键步骤！）
   ├─ 检查项目配置（next.config.ts, layout.tsx）
   ├─ 查看现有类似功能的实现
   ├─ 搜索相关代码模式
   │  └─ grep -r "类似功能" app/
   └─ 确认 runtime 要求

3. 📝 设计方案
   ├─ API 路由设计
   ├─ 数据库模型设计
   ├─ 页面组件结构
   └─ 状态管理方案

4. 🏗️ 编码实现
   ├─ 遵循项目现有模式
   ├─ 正确配置 runtime
   ├─ 保持代码一致性
   └─ 添加必要注释

5. ✅ 本地验证（必须！）
   ├─ 启动开发服务器测试
   ├─ 检查浏览器控制台错误
   ├─ 检查终端输出错误
   └─ 验证核心功能可用

6. 📝 文档更新
   ├─ 更新 README（如有新依赖）
   ├─ 更新 API 文档
   └─ 记录新的注意事项到本文档

7. 📦 提交代码
   └─ 说明已验证的功能和注意事项
```

### 示例：添加新的数据库查询页面

```typescript
// ❌ 错误示例（会报错）
import { createPrismaClient } from '@/lib/db/client';

const prisma = createPrismaClient();

export default async function MyPage() {
  const data = await prisma.model.findMany();
  return <div>{JSON.stringify(data)}</div>;
}
```

```typescript
// ✅ 正确示例
import { createPrismaClient } from '@/lib/db/client';

// 声明使用 Node.js runtime
export const runtime = 'nodejs';

const prisma = createPrismaClient();

export default async function MyPage() {
  const data = await prisma.model.findMany();
  return <div>{JSON.stringify(data)}</div>;
}
```

---

## ⚠️ 常见陷阱与解决方案

### 1. Prisma Edge Runtime 错误

**错误信息：**

```
PrismaClientValidationError: In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
```

**原因：**

- 页面/API 使用了 Prisma
- 但没有声明 `runtime = 'nodejs'`
- 继承了全局的 `runtime = 'edge'` 配置

**解决方案：**

```typescript
// 在文件顶部添加
export const runtime = 'nodejs';
```

**检查方法：**

```bash
# 找出所有使用 Prisma 但未声明 runtime 的文件
grep -l "createPrismaClient" app/**/*.{ts,tsx} | while read file; do
  if ! grep -q "runtime.*nodejs" "$file"; then
    echo "Missing runtime declaration: $file"
  fi
done
```

### 2. 文件路径问题

**问题：** Worker 处理上传时找不到文件

**原因：**

- 数据库存储相对路径：`lesson_21/xxx.jpeg`
- 实际文件位置：`uploads/lesson_21/xxx.jpeg`

**解决方案：**

```typescript
// 创建路径解析函数
function resolveFilePath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  if (filePath.startsWith('uploads/')) {
    return path.join(process.cwd(), filePath);
  }
  return path.join(process.cwd(), 'uploads', filePath);
}

// 使用
const fullPath = resolveFilePath(upload.filePath);
```

**预防措施：**

- 文件上传时统一路径格式
- 或者在读取时统一解析

### 3. 环境变量未配置

**问题：** API 调用失败，显示 undefined

**检查：**

```bash
# 确保 .env.local 存在且配置正确
cat .env.local | grep "MODELSCOPE_API_KEY"
cat .env.local | grep "DATABASE_URL"
```

**解决：**

```bash
# 复制示例配置
cp .env.example .env.local

# 编辑配置
nano .env.local
```

#### 多模型分析配置

- **必需**：`MODELSCOPE_API_KEY`（Qwen30B/235B 主力模型）
- **可选增强**：
  - GPT-4 Vision → 配置 `OPENAI_API_KEY` 并设置 `ENABLE_GPT4_VISION=true`
  - Claude 3.5 Vision → 配置 `ANTHROPIC_API_KEY` + `ENABLE_CLAUDE_VISION=true`
  - 豆包视觉 → 配置 `DOUBAO_API_KEY` + `ENABLE_DOUBAO_VL=true`
- **权重调整**：`QWEN30B_WEIGHT`、`QWEN235B_WEIGHT` 等控制融合占比
- **超时**：`SINGLE_MODEL_TIMEOUT`、`MULTI_MODEL_TIMEOUT`

> `modelConsensus`（0-1）越高代表多模型理解一致。一致性 < 0.6 时建议在 UI 中提示“需人工复核”。

### 4. TypeScript 路径别名问题

**问题：** `@/lib/...` 导入失败

**检查：** `tsconfig.json` 中的 paths 配置

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### 5. 开发环境 HMR 导致页面自动刷新

**问题：** 手机扫码上传页面在文件上传后自动刷新

**原因：**

Next.js 开发服务器会监听项目内所有文件的变化。当上传文件时，以下操作会触发 HMR（Hot Module Replacement）：

1. 上传的图片保存到 `uploads/` 目录
2. SQLite 数据库文件 (`prisma/dev.db`) 被修改

任何一个变化都会导致页面通过 WebSocket 热重载，在手机端表现为"自动刷新"。

**解决方案：**

`next.config.ts` 中配置 webpack 忽略这些文件变化：

```typescript
webpack: (config, { isServer, dev }) => {
  // ...
  if (dev) {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/prisma/*.db',
        '**/prisma/*.db-journal',
        '**/uploads/**',
      ],
    };
  }
  return config;
},
```

**自定义上传目录：**

可通过环境变量 `LOCAL_UPLOAD_DIR` 自定义，默认为 `./uploads`（见 `lib/storage/paths.ts`）

**生产环境注意事项：**

- Cloudflare Pages 没有本地文件系统，必须使用 R2 存储
- 此问题仅影响本地开发环境
- 存储抽象层 (`lib/storage/index.ts`) 自动选择正确的存储后端

---

## 📐 代码规范

### 文件组织

```
app/
├── api/                    # API 路由
│   └── [resource]/
│       ├── route.ts        # 基础 CRUD
│       └── [id]/
│           └── route.ts    # 子资源操作
├── [feature]/              # 功能页面
│   ├── page.tsx           # 服务端页面
│   ├── [feature]-client.tsx  # 客户端组件
│   └── components/         # 功能专用组件
├── actions/                # Server Actions
├── layout.tsx             # 全局布局
└── error.tsx              # 错误处理

lib/
├── [service]/             # 业务逻辑服务
│   ├── client.ts         # API 客户端
│   └── utils.ts          # 工具函数
├── db/                    # 数据库相关
└── config/                # 配置

components/                # 共享组件
├── ui/                    # 基础 UI 组件
└── [feature]/            # 功能组件

scripts/                   # 脚本（Worker等）
```

### 命名规范

**文件命名：**

- 页面: `page.tsx`
- API: `route.ts`
- 客户端组件: `[name]-client.tsx`
- 服务端组件: `[name].tsx`
- 工具函数: `[name]-utils.ts`

**组件命名：**

- React 组件: `PascalCase`
- 函数/变量: `camelCase`
- 常量: `UPPER_SNAKE_CASE`
- 类型: `PascalCase`

### 导入顺序

```typescript
// 1. React/Next.js
import { useState } from 'react';
import { redirect } from 'next/navigation';

// 2. 第三方库
import { z } from 'zod';

// 3. 项目内部（使用 @/ 别名）
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { Button } from '@/components/ui/button';

// 4. 相对导入（同目录）
import { FeatureClient } from './feature-client';

// 5. 类型导入
import type { User } from '@/types';
```

### 注释规范

**文件头注释：**

```typescript
/**
 * Feature Name
 *
 * 简短描述这个文件的功能
 *
 * @example
 * const result = await someFunction();
 */
```

**函数注释：**

```typescript
/**
 * 函数功能描述
 *
 * @param param1 - 参数说明
 * @param param2 - 参数说明
 * @returns 返回值说明
 */
export function myFunction(param1: string, param2: number): boolean {
  // ...
}
```

---

## 🔍 调试技巧

### 开发环境

**启动开发服务器：**

```bash
pnpm dev  # Next.js + Worker 一起启动
pnpm dev:next  # 只启动 Next.js
pnpm worker:dev  # 只启动 Worker
```

**查看日志：**

- 前端: 浏览器控制台
- API: 终端 `[Next]` 标签
- Worker: 终端 `[Worker]` 标签

**常用调试命令：**

```bash
# 查看数据库内容
sqlite3 prisma/dev.db "SELECT * FROM uploads LIMIT 5;"

# 查看 runtime 配置
grep -r "export const runtime" app/ | grep -v node_modules

# 检查 Prisma 生成
pnpm prisma generate

# 查看环境变量
cat .env.local
```

### 生产环境

**构建测试：**

```bash
pnpm build
pnpm start
```

**部署前检查：**

```bash
# TypeScript 类型检查
pnpm type-check

# 代码格式检查
pnpm format:check

# 运行测试
pnpm test
```

---

## 📚 学习资源

### 项目文档体系

本项目采用分层文档架构，每个文档服务不同的目标读者：

#### 核心开发规范

- **DEVELOPMENT_GUIDE.md** (本文档) - 开发规范权威参考
  - Runtime配置规则
  - 开发前检查清单
  - 新功能开发流程
  - 常见陷阱与解决方案
  - 代码规范

#### AI开发助手指南

- **CLAUDE.md** - 为Claude Code等AI助手优化的快速参考
  - 命令速查表
  - 代码模板
  - 架构概览（包括多模型融合系统）
  - 引用本文档获取详细规则

#### 贡献者指南

- **AGENTS.md** - 项目进度追踪与贡献指南
  - 当前开发进度（~98%）
  - 已完成/进行中/待开发模块
  - 快速上手命令
  - 目标用户与设计原则

#### 项目管理文档

- **AIteaching升级迁移方案.md** - 完整迁移计划与进度跟踪
  - 旧项目功能对比
  - 详细实施计划
  - 阶段完成度（P1 ✅, P2 ✅, P3-P4 📋）
  - 技术决策记录
  - 多模型融合架构说明

#### 专项技术文档

- **OCR_SYSTEM_README.md** - OCR系统完整文档
  - 系统架构
  - 三态分流逻辑
  - 多模型融合实现
  - API接口
  - 测试流程
- **WORKER_DEPLOYMENT.md** - Worker部署指南
  - GitHub Actions部署
  - VPS部署（PM2/systemd）
  - Docker部署
- **VDITOR_INTEGRATION_GUIDE.md** - Vditor编辑器集成
  - IR模式配置
  - 自动保存实现
  - 移动端适配

### 官方文档

- [Next.js Documentation](https://nextjs.org/docs)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)

### 项目特定文档

- [`README.md`](./README.md) - 项目概述
- [`OCR_SYSTEM_README.md`](./OCR_SYSTEM_README.md) - OCR 功能文档
- [`WORKER_DEPLOYMENT.md`](./WORKER_DEPLOYMENT.md) - Worker 部署指南
- [`AGENTS.md`](./AGENTS.md) - AI Agent 架构

---

## 🔄 本文档更新

当遇到新的陷阱或最佳实践时，请更新本文档：

1. 在对应章节添加内容
2. 更新目录
3. 添加实际案例
4. 提交更新说明

**最后更新：** 2025-11-23

**贡献者：**

- Claude Code Assistant - 初始版本（2025-11-20），基于实际踩坑经验
- 文档体系整合（2025-11-20）
- HMR 刷新问题解决方案（2025-11-22）
- 多模型融合系统文档更新（2025-11-23）
