# 学生作品OCR归档与分析系统 - P1阶段实现

## 📋 功能概览

本系统实现了基于魔搭社区VL模型的学生作品自动归档与AI分析功能，包括：

### ✅ 已完成功能（P1阶段）

1. **OCR智能识别**
   - 手写姓名识别
   - 作品类型分类（绘画/手工/文字/综合）
   - 内容描述生成
   - 关键词提取
   - 情感分析

2. **三态智能分流**
   - 自动归档（置信度>0.8）
   - AI建议确认（0.6-0.8）
   - 手动归档（<0.6）
   - 模糊姓名匹配（支持nickname）

3. **教师归档确认界面**
   - 九宫格照片预览
   - 批量确认自动归档
   - 下拉选择学生
   - 实时状态更新

4. **AI分析报告生成**
   - 整体评价
   - 类型分析
   - 情感倾向
   - 主题内容
   - 参与度统计
   - 教学建议

5. **Worker后台处理**
   - 开发环境热重载
   - 生产环境灵活部署
   - 错误重试机制
   - 优雅停机

---

## 🏗️ 技术架构

### 核心技术栈

- **前端**: Next.js 15.5 + React 19 + Tailwind CSS
- **后端**: Next.js App Router + Server Actions
- **数据库**: Cloudflare D1 (SQLite) + Prisma ORM
- **存储**: Cloudflare R2 (S3兼容)
- **AI模型**: ModelScope Qwen3-VL-30B-A3B-Instruct
- **Worker**: Node.js + TypeScript + tsx

### 项目结构

```
edge-next-starter/
├── lib/
│   ├── modelscope/
│   │   └── client.ts              # ModelScope API客户端（支持视觉模型）
│   ├── ocr/
│   │   ├── qwen-vl-client.ts      # OCR服务核心
│   │   └── image-utils.ts         # 图片处理工具
│   ├── upload/
│   │   ├── triage-service.ts      # 三态分流服务
│   │   └── fuzzy-match.ts         # 模糊匹配算法
│   └── analysis/
│       └── report-generator.ts    # 报告生成服务
├── app/
│   ├── api/
│   │   ├── uploads/
│   │   │   ├── [uploadId]/triage/route.ts  # 归档状态更新
│   │   │   └── batch/route.ts              # 批量操作
│   │   └── lessons/[lessonId]/
│   │       ├── pending-uploads/route.ts    # 获取待归档作品
│   │       └── report/route.ts             # 报告生成
│   └── lessons/[lessonId]/
│       ├── upload/page.tsx        # H5上传页面
│       ├── archive/
│       │   ├── page.tsx          # 归档确认页面
│       │   └── archive-client.tsx
│       └── report/
│           ├── page.tsx          # 分析报告页面
│           └── report-client.tsx
├── components/
│   └── archive/
│       ├── student-selector.tsx           # 学生选择器
│       ├── auto-matched-section.tsx       # 自动归档组件
│       ├── pending-confirmation-section.tsx  # AI建议组件
│       └── pending-manual-section.tsx     # 手动归档组件
├── scripts/
│   └── ocr-worker.ts             # OCR后台进程
├── .github/workflows/
│   └── ocr-worker.yml           # GitHub Actions配置
├── prisma/
│   └── schema.prisma            # 数据库模型（新增Report表）
└── WORKER_DEPLOYMENT.md         # Worker部署文档
```

---

## 🔄 完整工作流程

### 1. 学生上传作品

```
扫描二维码 → 批量选择照片 → 上传到R2 → 数据库记录(pending)
```

- URL: `/lessons/[lessonId]/upload`
- 支持多张照片批量上传
- 实时显示上传进度

### 2. OCR自动处理（Worker后台）

```
查找pending上传 → OCR识别 → 模糊匹配 → 三态分流 → 更新数据库
```

**处理详情：**

a) **OCR识别**

- 调用Qwen3-VL模型
- 识别学生姓名、作品类型、描述、关键词、情感
- 低温度（0.1）保证稳定输出

b) **模糊匹配**

- 精确匹配：name/nickname完全相同 → 置信度0.95/0.9
- 模糊匹配：Levenshtein距离≤2 → 置信度0.5-0.7
- 无匹配 → 置信度0.3

c) **三态分流**

- **auto_matched** (置信度>0.8): 自动归档
- **pending_confirmation** (0.6-0.8): AI建议
- **pending_manual** (<0.6): 手动归档

### 3. 教师归档确认

```
访问归档页面 → 批量确认/选择学生 → 归档完成
```

- URL: `/lessons/[lessonId]/archive`
- 三步操作：自动归档 → AI建议 → 手动归档
- 实时刷新查看处理进度

### 4. 生成分析报告

```
点击生成报告 → AI分析数据 → 生成Markdown报告 → 展示
```

- URL: `/lessons/[lessonId]/report`
- 基于已归档作品数据
- 800-1000字详细分析
- 包含教学建议

---

## 🔧 本地开发设置

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env.local`:

```env
# ModelScope API
MODELSCOPE_API_KEY=sk-xxx

# Database
DATABASE_URL=file:./dev.db

# R2 Storage (可选)
R2_BUCKET_NAME=your-bucket
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
```

### 3. 数据库迁移

```bash
# 生成Prisma客户端
pnpm prisma generate

# 创建Reports表迁移
pnpm wrangler d1 migrations create cloudflare-worker-template-local add_reports_table
```

编辑生成的SQL文件，添加：

```sql
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'class',
  content TEXT NOT NULL,
  generated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (lesson_id) REFERENCES lesson_cards (id)
);

CREATE INDEX idx_reports_lesson_id ON reports(lesson_id);
```

应用迁移：

```bash
pnpm db:migrate:local
```

### 4. 启动开发服务器

```bash
# 同时启动Next.js和Worker
pnpm dev

# 或者分别启动
pnpm dev:next  # 只启动Next.js
pnpm worker:dev  # 只启动Worker（热重载）
```

---

## 🌐 生产环境部署

详见 `WORKER_DEPLOYMENT.md`

### 快速选择：

- **小规模（<100张/天）**: GitHub Actions（免费，每5分钟运行）
- **中等规模（100-500张/天）**: VPS + PM2
- **大规模（>500张/天）**: 考虑分布式或更强大的服务器

---

## 📊 数据库模型

### Upload表（扩展）

```prisma
model Upload {
  id                 Int        @id @default(autoincrement())
  lessonId           Int

  // 文件信息
  filePath           String
  fileHash           String
  fileSize           Int
  originalFilename   String

  // OCR结果
  ocrText            String?
  recognizedName     String?
  ocrConfidence      Float?

  // 内容分析
  workType           String?     // 绘画/手工/文字/综合
  workDescription    String?
  workKeywords       String?     // JSON数组
  workEmotions       String?     // JSON数组

  // 三态分流
  triageStatus       String      // pending/auto_matched/pending_confirmation/pending_manual/confirmed/failed
  studentId          Int?
  suggestedStudentId Int?

  // 错误处理
  retryCount         Int         @default(0)
  lastError          String?

  // 时间戳
  uploadedAt         Int
  processedAt        Int?
  archivedAt         Int?
}
```

### Report表（新增）

```prisma
model Report {
  id          Int        @id @default(autoincrement())
  lessonId    Int
  reportType  String     @default("class")
  content     String     // Markdown格式
  generatedAt Int

  lesson LessonCard @relation(fields: [lessonId], references: [id])
}
```

---

## 🎯 API接口

### 上传相关

- `POST /api/lesson-upload` - 上传作品照片
- `POST /api/student-works` - 批量保存作品记录
- `GET /api/student-works?lessonId=xxx` - 获取作品列表

### 归档相关

- `GET /api/lessons/[lessonId]/pending-uploads` - 获取待归档作品
- `PATCH /api/uploads/[uploadId]/triage` - 更新归档状态
- `POST /api/uploads/batch` - 批量确认归档

### 报告相关

- `POST /api/lessons/[lessonId]/report` - 生成分析报告
- `GET /api/lessons/[lessonId]/report` - 获取已有报告

---

## 🧪 测试流程

### 1. 准备测试数据

- 创建测试班级和学生
- 准备3-5张包含学生姓名的作品照片

### 2. 测试上传

- 访问 `/lessons/[lessonId]/upload`
- 批量上传测试照片
- 确认上传成功

### 3. 测试Worker处理

```bash
# 单次运行模式（开发测试）
pnpm worker:once
```

查看日志输出，确认：

- OCR识别结果
- 三态分流状态
- 置信度分数

### 4. 测试归档确认

- 访问 `/lessons/[lessonId]/archive`
- 验证三个分组是否正确
- 测试批量确认、AI建议、手动归档功能

### 5. 测试报告生成

- 访问 `/lessons/[lessonId]/report`
- 点击"生成分析报告"
- 查看生成的报告内容

---

## 🔍 调试技巧

### 查看Worker日志

开发环境：

```bash
pnpm dev  # Worker日志会实时显示
```

生产环境：

```bash
# PM2
pm2 logs ocr-worker

# systemd
sudo journalctl -u ocr-worker -f

# Docker
docker logs -f ocr-worker
```

### 查看数据库状态

```sql
-- 查看各状态数量
SELECT triage_status, COUNT(*) FROM uploads GROUP BY triage_status;

-- 查看待处理
SELECT * FROM uploads WHERE triage_status = 'pending';

-- 查看失败原因
SELECT id, last_error FROM uploads WHERE triage_status = 'failed';
```

### 常见问题

**1. Worker不处理照片**

- 检查Worker是否运行
- 检查DATABASE_URL配置
- 检查MODELSCOPE_API_KEY

**2. OCR识别率低**

- 确保照片清晰
- 检查学生姓名是否在名单中
- 考虑调整置信度阈值

**3. API限流**

- ModelScope有每日调用限制
- 考虑添加重试延迟
- 或升级API套餐

---

## 🚀 性能优化建议

### 当前性能

- 单张照片OCR处理：5-10秒
- 三态分流：<1秒
- 报告生成：10-20秒

### 优化方向

1. **并发处理**
   - 目前串行处理避免数据库锁
   - 可考虑使用消息队列实现并发

2. **缓存优化**
   - 缓存学生名单查询
   - 缓存已生成的报告

3. **图片优化**
   - 压缩大图片
   - 使用WebP格式

4. **数据库索引**
   - 已添加关键字段索引
   - 定期VACUUM优化SQLite

---

## 📈 下一步计划（P2阶段）

### 高级功能

1. **多模型融合分析**
   - 使用Qwen2.5-VL协同分析
   - 提高识别准确率

2. **AI主动推荐**
   - 基于历史数据分析
   - 主动生成教学建议

3. **学期成长报告**
   - 跨课程数据聚合
   - 学生发展轨迹分析

4. **RAG知识库增强**
   - 教学策略知识库
   - 更精准的建议生成

### 系统优化

1. **实时通知**
   - WebSocket推送处理进度
   - 完成后通知教师

2. **批量导出**
   - 导出作品集PDF
   - 批量下载原图

3. **权限管理**
   - 细粒度权限控制
   - 多角色支持

---

## 📝 开发日志

**2025-11-19**

- ✅ 完成P1阶段所有功能
- ✅ 实现开发环境自动启动Worker
- ✅ 支持多种生产部署方式
- ✅ 完善文档和部署指南

---

## 🙏 致谢

- **ModelScope** - 提供强大的VL模型
- **Cloudflare** - 提供D1和R2服务
- **Next.js** - 优秀的全栈框架

---

## 📞 联系支持

如有问题或建议，请：

- 查看 `WORKER_DEPLOYMENT.md` 了解部署细节
- 检查GitHub Issues
- 查看Worker日志定位问题
