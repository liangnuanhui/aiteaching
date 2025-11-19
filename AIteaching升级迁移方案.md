# 心灵微光 AI助教工作台 - Next.js迁移升级方案

**文档版本**: v1.0
**创建日期**: 2025-11-19
**目标**: 将旧项目(AIteaching,path:/Users/sunsiqi/Documents/AIteaching/)完整功能迁移到Next.js新项目(edge-next-starter)

---

## 目录

- [项目状态概览](#项目状态概览)
- [核心架构对比](#核心架构对比)
- [缺失功能迁移清单](#缺失功能迁移清单)
- [详细迁移实施计划](#详细迁移实施计划)
- [数据库迁移策略](#数据库迁移策略)
- [AI服务迁移细节](#AI服务迁移细节)
- [前端UI/UX迁移](#前端UIUX迁移)
- [部署与测试计划](#部署与测试计划)
- [时间估算与里程碑](#时间估算与里程碑)
- [风险与应对策略](#风险与应对策略)

---

## 项目状态概览

### 旧项目（AIteaching）功能清单

已完整实现P0-P2阶段全部功能：

**P0阶段（核心教学）**:

- ✅ 教师登录系统
- ✅ 班级管理（支持小学1-6年级，初中1-3年级）
- ✅ 学生管理（含同名处理nickname）
- ✅ AI智能生成教案（基于ModelScope API）
- ✅ 课程卡片仪表盘
- ✅ 教案编辑器（H5课件 + Markdown教案）
- ✅ 课程状态管理（Draft → Ready）

**P1阶段（数据闭环）**:

- ✅ H5扫码上传学生作品
- ✅ OCR手写体识别（Qwen3-VL）
- ✅ AI辅助归档（三态分流）
- ✅ 作品内容分析（类型、关键词、情感）
- ✅ 教师确认归档流程
- ✅ AI深度分析报告
- ✅ RAG知识库（教师私有文档）
- ✅ 班级H5报告分享

**P2阶段（深度洞察）**:

- ✅ 多模型融合分析（视觉+语言）
- ✅ AI主动推荐（"李老师，我发现..."）
- ✅ 学期成长报告
- ✅ 班级情绪雷达图

### 新项目（edge-next-starter）已实现功能

**后端基础设施**:

- ✅ Cloudflare D1数据库（Prisma ORM）
- ✅ Cloudflare R2对象存储
- ✅ Cloudflare KV缓存
- ✅ NextAuth v5认证系统
- ✅ ModelScope API集成

**前端页面**:

- ✅ 登录/注册页面
- ✅ 课程仪表盘（dashboard）
- ✅ 班级管理（classes）
- ✅ 学生管理（students）
- ✅ 课程详情页（三栏式布局）
- ✅ 文件上传测试页

**核心功能**:

- ✅ AI教案生成（完整复现旧项目）
- ✅ 课程卡片CRUD操作
- ✅ 基础文件上传（R2存储）

### 功能差距总结

| 功能模块     | 旧项目      | 新项目          | 迁移优先级 |
| ------------ | ----------- | --------------- | ---------- |
| 学生作品上传 | ✅ 完整     | ⚠️ 只有基础上传 | 高         |
| OCR识别      | ✅ Qwen3-VL | ❌ 未实现       | 高         |
| AI辅助归档   | ✅ 三态分流 | ❌ 未实现       | 高         |
| 内容分析     | ✅ 多维度   | ❌ 未实现       | 中         |
| RAG知识库    | ✅ 完整     | ⚠️ 基础架构     | 中         |
| 多模型融合   | ✅ 已实现   | ❌ 未实现       | 低         |
| AI主动推荐   | ✅ 已实现   | ❌ 未实现       | 低         |
| 学期报告     | ✅ 已实现   | ❌ 未实现       | 低         |

---

## 核心架构对比

### 技术栈对比

| 技术维度     | 旧项目 (AIteaching)  | 新项目 (edge-next-starter) | 迁移策略     |
| ------------ | -------------------- | -------------------------- | ------------ |
| **后端框架** | FastAPI + Python     | Next.js App Router         | Node.js重写  |
| **数据库**   | SQLite + SQLModel    | Cloudflare D1 + Prisma     | 数据模型迁移 |
| **存储**     | 本地文件系统         | Cloudflare R2              | 已升级✅     |
| **AI平台**   | ModelScope           | ModelScope                 | 保持不变✅   |
| **前端框架** | Vue 3 + Element Plus | React 19 + Tailwind        | 完全重写✅   |
| **认证**     | 简单session          | NextAuth v5                | 已升级✅     |
| **部署**     | 本地/ModelScope      | Cloudflare Pages           | 已升级✅     |
| **缓存**     | SQLite               | Cloudflare KV              | 已升级✅     |

### 数据模型对比

| 数据表        | 旧项目 (SQLAlchemy) | 新项目 (Prisma)          | 兼容性     |
| ------------- | ------------------- | ------------------------ | ---------- |
| User          | username: String    | email + password: String | 字段变更⚠️ |
| Class         | grade_level: String | gradeLevel: String       | ✅完全一致 |
| Student       | nickname: String?   | nickname: String?        | ✅完全一致 |
| LessonCard    | 完整字段            | 完整字段                 | ✅完全一致 |
| LessonContent | 完整字段            | 完整字段                 | ✅完全一致 |
| Upload        | 完整字段            | 完整字段                 | ✅完全一致 |

**注意**: User表需要从username登录迁移到email登录，需要数据迁移脚本。

### AI服务调用方式

**旧项目 (Python)**:

```python
# services/llm_service.py
from openai import OpenAI

client = OpenAI(
    base_url='https://api-inference.modelscope.cn/v1/',
    api_key=MODELSCOPE_TOKEN
)

response = client.chat.completions.create(
    model='Qwen/Qwen3-Next-80B-A3B-Thinking',
    messages=[...]
)
```

**新项目 (TypeScript)**:

```typescript
// lib/modelscope/client.ts
export async function callModelScopeChat(messages: ChatMessage[], options?: { model?: string }) {
  const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MODELSCOPE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options?.model || 'Qwen/Qwen3-Next-80B-A3B-Thinking',
      messages,
    }),
  });
  return response.json();
}
```

**结论**: AI调用方式保持一致，只是语言从Python变为TypeScript。

---

## 缺失功能迁移清单

### 1. 学生作品上传与OCR处理（P1核心）

#### 现状分析

- 新项目只有基础文件上传API，缺少学生作品业务逻辑
- 旧项目有完整的上传、OCR、归档流程
- Upload模型已存在数据库，需要实现业务层

#### 需要迁移的功能

**1.1 H5上传页面**

- 路径: `/upload` 或 `/lessons/[lessonId]/upload`
- 功能要求:
  - 二维码扫描进入（课程专属）
  - 批量选择照片（一次性多选）
  - 并发上传控制（同时3个）
  - 自动重试机制（失败重试3次）
  - Wake Lock API防锁屏
  - 上传进度显示
  - 网络断开提醒

**1.2 OCR识别服务**

- 文件: `lib/ocr/qwen-vl-client.ts`
- 功能:
  - 调用Qwen3-VL视觉模型
  - 手写姓名识别
  - 作品内容分析（类型、描述、关键词、情感）
  - 置信度计算（0.0-1.0）
  - HEIC格式转换
  - 错误处理与重试

**1.3 三态分流归档逻辑**
旧项目逻辑（Python）:

```python
if confidence > 0.8 and matched_student:
    upload.triage_status = 'auto_matched'
    upload.student_id = matched_student.id
elif confidence > 0.6:
    upload.triage_status = 'pending_confirmation'
    upload.suggested_student_id = matched_student.id
else:
    upload.triage_status = 'pending_manual'
```

**1.4 教师确认归档UI**

- 路径: `/lessons/[lessonId]/archive`
- 功能:
  - 九宫格展示待确认作品
  - 批量确认"自动归档"
  - AI建议下拉选择
  - 手动选择学生（同名显示nickname）
  - 一键完成归档

**1.5 Worker后台进程**

- 文件: `scripts/ocr-worker.ts`
- 功能:
  - 轮询pending状态的uploads
  - 调用OCR服务
  - 更新数据库状态
  - 错误重试（retry_count）
  - 单进程串行处理（避免数据库锁）

#### 技术实现方案

```
目录结构:
app/
├── lessons/
│   └── [lessonId]/
│       ├── upload/
│       │   └── page.tsx          # H5上传页面
│       └── archive/
│           └── page.tsx          # 教师归档确认

lib/
├── ocr/
│   ├── qwen-vl-client.ts         # OCR客户端
│   ├── content-analyzer.ts       # 内容分析
│   └── name-matcher.ts           # 姓名匹配
├── upload/
│   ├── processor.ts              # 上传处理器
│   └── validator.ts              # 验证器

scripts/
└── ocr-worker.ts                 # 后台Worker

API路由:
- POST /api/uploads/signed        # 生成签名URL
- GET /api/uploads/lesson/[id]    # 获取课程作品
- PATCH /api/uploads/[id]/triage  # 更新归档状态
```

### 2. 内容版本管理（P1优化）

#### 现状分析

- LessonContent模型已存在数据库
- 缺少管理界面和业务逻辑
- 旧项目支持内容共享和版本控制

#### 需要迁移的功能

**2.1 内容版本创建与更新**

- 批量课程共享相同内容
- 内容编辑时同步更新所有关联课程
- 版本历史追踪

**2.2 批量发布功能**

- 选择多个班级同时创建课程
- 共享相同的LessonContent
- 减少存储空间（节省70-90%）

#### 技术实现方案

```typescript
// app/actions/contents.ts
export async function createContentVersion(data: {
  title: string;
  h5Json: string;
  mdPlan: string;
  lessonIds: number[];
}) { ... }

export async function updateContentVersion(
  contentId: string,
  data: { h5Json?: string; mdPlan?: string }
) { ... }
```

### 3. AI分析报告生成（P1核心）

#### 现状分析

- 缺少分析服务
- Old项目有完整的学生作品分析和报告生成
- 需要迁移`services/analysis_service.py`

#### 需要迁移的功能

**3.1 学生作品聚合分析**

- 按学生聚合所有作品
- 按类型统计（绘画、手工、文字）
- 关键词云图
- 情感分布

**3.2 班级报告生成**

- AI生成的班级总结
- 教学效果评估
- 学生参与度分析
- 改进建议

**3.3 报告导出**

- DOCX格式（使用docx库）
- PDF格式
- H5分享页面

#### 技术实现方案

```typescript
// lib/analysis/report-generator.ts
export class ReportGenerator {
  async generateClassReport(lessonId: number) {
    const uploads = await this.getArchivedUploads(lessonId);
    const analysis = await this.analyzeUploads(uploads);
    return this.callLLMToGenerateReport(analysis);
  }

  async generateStudentReport(studentId: number) {
    // 生成学生个人成长报告
  }
}
```

### 4. RAG知识库（P1进阶）

#### 现状分析

- 基础架构已具备（可上传文件到R2）
- 缺少文档解析和向量存储
- 需要集成ChromaDB

#### 需要迁移的功能

**4.1 文档解析**

- PDF解析（使用Tika或LangChain）
- DOCX解析
- PPTX解析
- 文本提取和清洗

**4.2 向量存储**

- ChromaDB集成
- 文本分块（512 tokens）
- Embedding生成（BAAI/bge-large-zh-v1.5）
- 教师私有collection

**4.3 RAG增强备课**

- 检索相关文档
- Prompt合并上下文
- 生成带参考文献的教案

#### 技术实现方案

```typescript
// lib/rag/document-processor.ts
export class DocumentProcessor {
  async processDocument(filePath: string) {
    const text = await this.extractText(filePath);
    const chunks = await this.splitText(text);
    const embeddings = await this.generateEmbeddings(chunks);
    await this.storeInVectorDB(embeddings, chunks);
  }
}

// lib/rag/retriever.ts
export class KnowledgeRetriever {
  async retrieve(gradeLevel: string, topic: string) {
    const query = `${gradeLevel}${topic}`;
    const results = await chromaClient.query({
      collection: `teacher_${userId}_kb`,
      query,
      nResults: 5,
    });
    return results;
  }
}
```

### 5. 高级AI功能（P2）

#### 现状分析

- 旧项目已实现，新项目未开始
- 包括多模型融合、AI推荐、学期报告

#### 需要迁移的功能

**5.1 多模型融合分析**

- 视觉模型：Qwen2.5-VL
- 分析维度：色彩情绪、画面主体、创意元素
- 融合算法：加权平均 + 专家投票

**5.2 AI主动推荐**

- 分析历史课程数据
- 识别有效教学策略
- 主动生成建议（"李老师，我发现..."）

**5.3 学期成长报告**

- 全学期数据聚合
- 学生个人档案
- 班级发展趋势

---

## 详细迁移实施计划

### 阶段1：核心功能补全（优先级：高）

**目标**: 让新项目达到旧项目P1完整功能（上课 + 归档）

**预计时间**: 2-3周

#### 任务1.1: H5上传页面（2天）

**文件位置**:

- `app/lessons/[lessonId]/upload/page.tsx`
- `components/upload/h5-uploader.tsx`

**功能要求**:

- [ ] 响应式移动端设计
- [ ] 二维码扫描认证
- [ ] 批量选择照片（`<input type="file" multiple>`）
- [ ] 并发上传控制（使用p-queue库，并发3）
- [ ] 进度条显示
- [ ] 自动重试（最多3次）
- [ ] Wake Lock API集成
- [ ] 网络断开检测与提醒

**技术要点**:

```typescript
// 核心代码示例
import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 3 });

async function uploadPhotos(photos: File[]) {
  // 请求Wake Lock
  const wakeLock = await navigator.wakeLock.request('screen');

  photos.forEach(photo => {
    queue.add(() => uploadWithRetry(photo, 3));
  });

  await queue.onIdle();
  wakeLock.release();
}

async function uploadWithRetry(file: File, retries: number) {
  for (let i = 0; i < retries; i++) {
    try {
      return await uploadFile(file);
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // 指数退避
    }
  }
}
```

#### 任务1.2: OCR服务迁移（3天）

**文件位置**:

- `lib/ocr/qwen-vl-client.ts`
- `lib/ocr/content-analyzer.ts`
- `lib/ocr/name-matcher.ts`

**功能要求**:

- [ ] 调用Qwen3-VL视觉语言模型
- [ ] 手写姓名识别（置信度计算）
- [ ] 作品内容分析（类型、描述、关键词、情感）
- [ ] HEIC格式转换
- [ ] 错误处理与重试机制

**技术要点**:

```typescript
// lib/ocr/qwen-vl-client.ts
export interface OCRResult {
  studentName: string;
  workType: string;
  description: string;
  keywords: string[];
  emotions: string[];
  textContent: string;
  confidence: number;
}

export class QwenVLClient {
  private readonly apiKey: string;
  private readonly model = 'Qwen/Qwen3-VL-30B-A3B-Instruct';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async recognizeImage(imagePath: string): Promise<OCRResult> {
    // 1. 读取图片并转base64
    const imageBase64 = await this.imageToBase64(imagePath);

    // 2. 构建多任务prompt
    const prompt = this.buildMultiTaskPrompt();

    // 3. 调用API
    const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    return this.parseResponse(data);
  }

  private buildMultiTaskPrompt(): string {
    return `请仔细分析这张学生作品照片，以JSON格式返回以下结构化信息：
{
  "student_name": "图片上清晰可辨的学生手写姓名，如果没有则返回空字符串",
  "work_type": "从【绘画、手工制作、文字书写、综合创作】中选择最符合的一项",
  "description": "用20-30字具体描述作品的主题、内容和视觉特征",
  "text_content": "按阅读顺序识别图片中出现的所有文字内容",
  "keywords": ["作品核心主题词", "主要视觉元素", "表达的关键概念"],
  "emotions": ["从【快乐、温馨、思念、感恩、自豪、期待、创意、努力】中选择最贴切的1-2个"]
}`;
  }

  private parseResponse(data: any): OCRResult {
    const content = data.choices[0].message.content;
    // 解析JSON并返回结果
    // ...
  }

  private async imageToBase64(path: string): Promise<string> {
    // 实现图片转base64
    // 支持HEIC格式转换
  }
}
```

#### 任务1.3: 三态分流归档逻辑（2天）

**文件位置**:

- `lib/upload/triage-service.ts`
- `app/actions/uploads.ts`

**业务规则**:

```typescript
export type TriageStatus =
  | 'pending' // 待处理
  | 'processing' // 处理中
  | 'auto_matched' // 自动匹配成功（置信度>0.8）
  | 'pending_confirmation' // 待教师确认（置信度0.6-0.8）
  | 'pending_manual' // 待手动归档（置信度<0.6）
  | 'confirmed_manual' // 已手动确认
  | 'failed'; // 处理失败

export class TriageService {
  async triageUpload(uploadId: number, ocrResult: OCRResult) {
    const { studentName, confidence } = ocrResult;

    // 查找匹配的学生
    const students = await this.getStudentsInClass(upload.classId);
    const matched = await this.fuzzyMatchStudent(studentName, students);

    let status: TriageStatus;
    let studentId: number | null = null;
    let suggestedStudentId: number | null = null;

    if (confidence > 0.8 && matched) {
      // 高置信度，自动归档
      status = 'auto_matched';
      studentId = matched.id;
    } else if (confidence > 0.6 && matched) {
      // 中等置信度，建议归档
      status = 'pending_confirmation';
      suggestedStudentId = matched.id;
    } else {
      // 低置信度，手动归档
      status = 'pending_manual';
    }

    await this.updateUpload(uploadId, {
      triageStatus: status,
      studentId,
      suggestedStudentId,
      recognizedName: studentName,
      ocrConfidence: confidence,
      workType: ocrResult.workType,
      workDescription: ocrResult.description,
      workKeywords: JSON.stringify(ocrResult.keywords),
      workEmotions: JSON.stringify(ocrResult.emotions),
    });

    return { status, studentId, suggestedStudentId };
  }

  private async fuzzyMatchStudent(name: string, students: Student[]) {
    // 模糊匹配算法
    // 1. 精确匹配
    // 2. Levenshtein距离
    // 3. 包含匹配
    // 4. 考虑nickname
  }
}
```

#### 任务1.4: 教师确认归档UI（2天）

**文件位置**:

- `app/lessons/[lessonId]/archive/page.tsx`
- `components/archive/confirmation-panel.tsx`

**界面布局**:

```typescript
// 三步确认流程

// 步骤1: 自动归档（九宫格批量确认）
<AutoMatchedSection
  uploads={autoMatchedUploads}
  onConfirmAll={handleConfirmAll}
/>

// 步骤2: AI建议（下拉选择）
<PendingConfirmationSection
  uploads={pendingConfirmationUploads}
  students={students}
  onConfirm={handleConfirmSuggestion}
/>

// 步骤3: 手动归档
<PendingManualSection
  uploads={pendingManualUploads}
  students={students}
  onAssign={handleManualAssign}
/>

// 同名处理显示："张三 (大张三)"
<StudentSelector>
  {students.map(s => (
    <option key={s.id} value={s.id}>
      {s.name} {s.nickname ? `(${s.nickname})` : ''}
    </option>
  ))}
</StudentSelector>
```

#### 任务1.5: Worker后台进程（3天）

**文件位置**:

- `scripts/ocr-worker.ts`
- `lib/worker/poller.ts`

**实现要点**:

```typescript
#!/usr/bin/env node

import { createPrismaClient } from '@/lib/db/client';
import { getOCRService } from '@/lib/ocr/qwen-vl-client';

const prisma = createPrismaClient();
const ocrService = getOCRService();

async function processPendingUploads() {
  // 串行处理，避免数据库锁
  const upload = await prisma.upload.findFirst({
    where: {
      triageStatus: 'pending',
      retryCount: { lt: 3 }, // 最多重试3次
    },
    orderBy: { uploadedAt: 'asc' },
  });

  if (!upload) {
    return false; // 没有待处理任务
  }

  try {
    // 标记为处理中
    await prisma.upload.update({
      where: { id: upload.id },
      data: { triageStatus: 'processing' },
    });

    // OCR识别
    const result = await ocrService.recognizeImage(upload.filePath);

    // 三态分流
    const triageService = new TriageService();
    await triageService.triageUpload(upload.id, result);

    // 标记处理完成
    await prisma.upload.update({
      where: { id: upload.id },
      data: {
        processedAt: Math.floor(Date.now() / 1000),
      },
    });
  } catch (error) {
    // 错误处理
    await prisma.upload.update({
      where: { id: upload.id },
      data: {
        retryCount: { increment: 1 },
        lastError: error.message,
        triageStatus: upload.retryCount >= 2 ? 'failed' : 'pending',
      },
    });
  }

  return true; // 处理了一个任务
}

// 主循环
async function main() {
  console.log('🤖 OCR Worker started...');

  while (true) {
    try {
      const hasMore = await processPendingUploads();

      if (!hasMore) {
        // 没有任务，休息5秒
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

main().catch(console.error);
```

**运行方式**:

```bash
# 开发环境
npm run worker:dev

# 生产环境（PM2）
pm2 start scripts/ocr-worker.js --name ocr-worker
```

### 阶段2: 内容管理与版本控制（优先级：中）

**预计时间**: 1-2周

#### 任务2.1: 内容版本管理（2天）

**文件位置**:

- `lib/content/version-manager.ts`
- `app/actions/contents.ts`

**功能**:

- 创建共享内容版本
- 批量课程使用相同内容
- 版本历史查看
- 内容编辑同步更新

**API示例**:

```typescript
// 创建共享内容
export async function createSharedContent(formData: FormData) {
  const title = formData.get('title')?.toString();
  const h5Json = formData.get('h5Json')?.toString();
  const mdPlan = formData.get('mdPlan')?.toString();
  const lessonIds = formData.get('lessonIds')?.toString().split(',');

  const contentId = `content_${Date.now()}`;

  // 创建内容版本
  const content = await prisma.lessonContent.create({
    data: {
      id: contentId,
      title,
      h5Json: h5Json || '{}',
      mdPlan: mdPlan || '',
      version: 1,
    },
  });

  // 更新所有课程的content_id
  await prisma.lessonCard.updateMany({
    where: { id: { in: lessonIds?.map(id => parseInt(id)) || [] } },
    data: {
      contentId,
      isContentShared: true,
      originalContentId: contentId,
    },
  });

  return { success: true, contentId };
}
```

#### 任务2.2: AI分析服务（4天）

**文件位置**:

- `lib/analysis/report-generator.ts`
- `lib/analysis/multi-model-aggregator.ts`

**功能**:

- 作品聚合分析（按学生、类型、时间）
- 班级报告生成（调用LLM）
- 情绪分析可视化
- 关键词统计

**实现示例**:

```typescript
export class ReportGenerator {
  async generateClassReport(lessonId: number) {
    // 1. 获取已归档作品
    const uploads = await prisma.upload.findMany({
      where: {
        lessonId,
        triageStatus: 'confirmed_manual',
      },
    });

    // 2. 聚合数据
    const aggregated = this.aggregateUploads(uploads);

    // 3. 调用LLM生成报告
    const prompt = this.buildReportPrompt(aggregated);
    const report = await callModelScopeChat([
      { role: 'system', content: '你是一名教育分析专家' },
      { role: 'user', content: prompt },
    ]);

    // 4. 保存报告
    await prisma.report.create({
      data: {
        lessonId,
        content: report,
        status: 'complete',
      },
    });

    return report;
  }

  private aggregateUploads(uploads: Upload[]) {
    return {
      totalWorks: uploads.length,
      byType: this.groupBy(uploads, 'workType'),
      byEmotion: this.groupBy(uploads, 'workEmotions'),
      topKeywords: this.extractKeywords(uploads),
      studentStats: this.analyzeByStudent(uploads),
    };
  }
}
```

### 阶段3: RAG知识库（优先级：中）

**预计时间**: 2周

#### 任务3.1: 文档解析与向量存储（5天）

**技术选型**:

- 文档解析: LangChain Document Loaders
- 文本分块: LangChain Text Splitter
- Embedding: BAAI/bge-large-zh-v1.5 (通过ModelScope API)
- 向量数据库: ChromaDB (本地文件存储)

**文件位置**:

- `lib/rag/document-processor.ts`
- `lib/rag/vector-store.ts`
- `lib/rag/retriever.ts`

**实现**:

```typescript
// lib/rag/document-processor.ts
export class DocumentProcessor {
  async processDocument(filePath: string) {
    // 1. 加载文档
    const loader = this.getLoader(filePath);
    const docs = await loader.load();

    // 2. 文本分块
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 512,
      chunkOverlap: 50,
    });
    const chunks = await splitter.splitDocuments(docs);

    // 3. 生成embedding
    const embeddings = await this.generateEmbeddings(chunks.map(c => c.pageContent));

    // 4. 存储到ChromaDB
    await this.vectorStore.addDocuments(chunks, embeddings);
  }

  private async generateEmbeddings(texts: string[]) {
    // 调用ModelScope Embedding API
    const response = await fetch('https://api-inference.modelscope.cn/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MODELSCOPE_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'BAAI/bge-large-zh-v1.5',
        input: texts,
      }),
    });

    const data = await response.json();
    return data.embeddings;
  }
}
```

#### 任务3.2: RAG增强备课（3天）

**文件位置**:

- `lib/rag/prompt-enhancer.ts`
- `app/actions/lessons.ts`（修改）

**实现**:

```typescript
// 修改createLesson action
export async function createLesson(formData: FormData) {
  // ...原有逻辑...

  // 查询知识库
  const retriever = new KnowledgeRetriever();
  const relevantDocs = await retriever.retrieve(cls.gradeLevel, title);

  // 构建增强prompt
  const context = relevantDocs.map(doc => doc.content).join('\n\n');

  const systemPrompt = `你是${grade}德育老师。参考以下资料：\n\n${context}\n\n请设计课程...`;

  // 调用LLM生成教案
  const result = await callModelScopeChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // ...后续处理...
}
```

### 阶段4: 高级功能（优先级：低）

**预计时间**: 2-3周

#### 任务4.1: 多模型融合分析（4天）

**文件位置**:

- `lib/analysis/multi-model-aggregator.ts`

**实现**:

```typescript
export class MultiModelAggregator {
  async analyzeUpload(uploadId: number) {
    const upload = await prisma.upload.findUnique({ where: { id: uploadId } });

    // 1. Qwen-VL视觉分析
    const visualResult = await this.analyzeVisual(upload.filePath);

    // 2. LLM文本分析
    const textResult = await this.analyzeText(upload.ocrText || '');

    // 3. 融合结果
    const fused = this.fuseResults([visualResult, textResult]);

    // 4. 保存分析结果
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        workType: fused.workType,
        workDescription: fused.description,
        workKeywords: JSON.stringify(fused.keywords),
        workEmotions: JSON.stringify(fused.emotions),
        contentExtractedAt: Math.floor(Date.now() / 1000),
      },
    });

    return fused;
  }

  private async analyzeVisual(imagePath: string) {
    // 调用Qwen2.5-VL
    // 分析色彩、主体、情绪
  }

  private async analyzeText(text: string) {
    // 调用LLM分析文本内容
  }

  private fuseResults(results: any[]) {
    // 加权平均或专家投票
    // 返回融合后的结果
  }
}
```

#### 任务4.2: AI主动推荐（3天）

**文件位置**:

- `lib/analysis/proactive-advisor.ts`

**实现**:

```typescript
export class ProactiveAdvisor {
  async generateSuggestion(teacherId: number, classId: number) {
    // 1. 获取最近10节已完成课程
    const lessons = await prisma.lessonCard.findMany({
      where: {
        classId,
        status: 'complete',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 2. 提取特征
    const features = await this.extractFeatures(lessons);

    // 3. 生成建议prompt
    const prompt = this.buildSuggestionPrompt(features);

    // 4. 调用LLM
    const suggestion = await callModelScopeChat([
      { role: 'system', content: '你是AI助教，基于数据分析提供建议' },
      { role: 'user', content: prompt },
    ]);

    return suggestion;
  }
}
```

#### 任务4.3: 学期成长报告（3天）

**文件位置**:

- `app/reports/semester/page.tsx`
- `lib/reports/semester-generator.ts`

---

## 数据库迁移策略

### 数据模型映射

#### User表迁移

旧项目使用username登录，新项目使用email登录，需要迁移策略：

**方案1: 自动生成email**

```typescript
// 迁移脚本
const users = await oldDb.query('SELECT * FROM users');

for (const user of users) {
  await newDb.user.create({
    data: {
      email: `${user.username}@migration.local`, // 自动生成
      name: user.username,
      // 设置临时密码，用户首次登录需重置
      password: await hash('temp_password_123'),
    },
  });
}
```

**方案2: 要求用户重新注册**

- 只迁移班级、学生、课程数据
- 用户需要重新注册账号
- 通过邀请码关联旧数据

**推荐**: 方案2更安全，避免生成虚假email

#### 核心数据表（无需转换）

- ✅ Class (完全一致)
- ✅ Student (完全一致)
- ✅ LessonCard (完全一致)
- ✅ LessonContent (完全一致)
- ✅ Upload (完全一致)

### 迁移脚本

**步骤1: 导出旧数据**

```bash
cd /Users/sunsiqi/Documents/AIteaching

# 导出为JSON
python -c "
from models.database import *
from sqlmodel import Session, create_engine
import json

engine = create_engine('sqlite:///persistent_storage/app.db')
with Session(engine) as session:
    classes = session.query(Class).all()
    students = session.query(Student).all()
    lessons = session.query(LessonCard).all()
    uploads = session.query(Upload).all()

    data = {
        'classes': [c.dict() for c in classes],
        'students': [s.dict() for s in students],
        'lessons': [l.dict() for l in lessons],
        'uploads': [u.dict() for u in uploads],
    }

    with open('backup_data.json', 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
"
```

**步骤2: 导入到新项目**

```typescript
// scripts/migrate-data.ts
import { PrismaClient } from '@prisma/client';
import backupData from './backup_data.json';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting data migration...');

  // 迁移班级数据
  for (const cls of backupData.classes) {
    await prisma.class.create({
      data: {
        id: cls.id,
        name: cls.name,
        gradeLevel: cls.grade_level,
        teacherId: cls.teacher_id, // 需要先创建用户
        createdAt: cls.created_at,
      },
    });
  }

  // 迁移学生数据
  for (const student of backupData.students) {
    await prisma.student.create({
      data: {
        id: student.id,
        name: student.name,
        classId: student.class_id,
        nickname: student.nickname,
        createdAt: student.created_at,
      },
    });
  }

  // 迁移课程数据
  for (const lesson of backupData.lessons) {
    await prisma.lessonCard.create({
      data: {
        id: lesson.id,
        title: lesson.title,
        classId: lesson.class_id,
        h5Json: lesson.h5_json,
        mdPlan: lesson.md_plan,
        lessonGroupId: lesson.lesson_group_id,
        contentId: lesson.content_id,
        isContentShared: lesson.is_content_shared,
        originalContentId: lesson.original_content_id,
        status: lesson.status,
        createdAt: lesson.created_at,
        updatedAt: lesson.updated_at,
        deletedAt: lesson.deleted_at,
      },
    });
  }

  console.log('Migration completed!');
}

migrate().catch(console.error);
```

---

## AI服务迁移细节

### LLM服务迁移

#### 旧项目 (Python)

````python
# services/llm_service.py
def generate_lesson_plan(
    self,
    grade_level: str,
    topic: str,
    additional_context: Optional[str] = None
) -> Dict[str, Any]:
    system_prompt = f"""### "心灵微光"首席教育专家 (Prompt v1.7)

**角色 (Role):** "心灵微光"首席教育专家

**核心使命:** 为{grade_level}教师赋能，专注班会/心理/德育课程

**分层适配:** 必须严格基于{grade_level}认知水平

**双重产出:**
1. H5演示数据包 (JSON)
2. 详细可打印教案 (Markdown)
"""

    user_prompt = f"""
**当前任务:** 为{grade_level}学生设计{topic}课程

**产出要求:**
1. 课程标题（10字以内）
2. H5演示数据包（JSON，5-8张幻灯片）
3. 详细教案（Markdown，3000-5000字）

**输出格式:**
```title
课程标题
````

```json
{ "h5_data": { "slides": [...] } }
```

```markdown
# {grade_level}德育课教案：[课程标题]

...
```

请现在开始设计！
"""

    if additional_context:
        system_prompt += f"\n\n**参考资料:**\n{additional_context}"

    response = self.client.chat.completions.create(
        model='Qwen/Qwen3-Next-80B-A3B-Thinking',
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt}
        ],
        temperature=0.7,
        max_tokens=8000
    )

    content = response.choices[0].message.content

    return {
        'title': self._extract_title(content),
        'h5_json': self._extract_json(content),
        'md_plan': self._extract_markdown(content),
        'model_used': 'Qwen3-Next-80B-A3B-Thinking',
        'mode': 'API',
        'tokens_used': response.usage.total_tokens
    }

````

#### 新项目 (TypeScript) - 已实现✅
```typescript
// app/actions/lessons.ts
export async function createLesson(formData: FormData) {
  // ...权限验证...

  // 准备system prompt
  const systemPrompt = `### "心灵微光"首席教育专家 (Prompt v1.7)

你是一名融合了班主任、心理健康老师和教案设计专家于一身的“AI副班主任”，服务对象是乡村 ${grade} 老师。

核心原则：
- 严格分层适配：所有内容必须符合 ${grade} 学生的认知水平。
- 聚焦班会课、心理课、德育课等非学科课程。
- 产出结构化、可直接用于课堂和电子白板展示的教案和课件。`;

  // 准备user prompt
  const userPrompt = [
    `**当前任务：** 为 **${grade}** 学生设计一节「${title}」课程（班会 / 心理 / 德育方向）`,
    '',
    '**Self-Correction (内部思考)：**',
    '1. 先思考本年级学生的认知特点和班级常见问题；',
    '2. 再把"课程主题"具体化为学生听得懂的语言；',
    '3. 选择 2–3 个适合本年级的活动形式（游戏、故事、讨论、角色扮演等）。',
    '',
    '**产出要求：**',
    '你必须一次性按下面的格式输出三个部分：',
    '',
    '1. 课程标题（10字以内，简洁有力）',
    '2. H5 演示数据包（JSON），用于课堂幻灯片放映',
    '3. 详细教案（Markdown），方便教师备课与打印',
    '',
    '**输出格式（严格遵守，下方代码块必须完整）：**',
    '',
    '```title',
    '课程标题',
    '```',
    '',
    '```json',
    '{',
    '  "h5_data": {',
    '    "slides": [',
    '      {',
    '        "type": "title",',
    '        "title": "课程标题",',
    '        "subtitle": "年级或副标题（可选）"',
    '      },',
    '      // ...更多幻灯片...',
    '    ]',
    '  }',
    '}',
    '```',
    '',
    '```markdown',
    `# ${grade}德育课教案：[课程标题]`,
    '',
    '## 一、教学目标',
    '...',
    '```',
  ].join('\n');

  // 调用ModelScope API
  const result = await callModelScopeChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { model: 'Qwen/Qwen3-Next-80B-A3B-Thinking' }
  );

  const content = result.choices[0]?.message.content || '';

  // 解析内容
  const titleMatch = content.match(/```title\s*([\s\S]*?)```/);
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  const mdMatch = content.match(/```markdown\s*([\s\S]*?)```/);

  const extractedTitle = titleMatch ? titleMatch[1].trim() : title;
  const h5Json = jsonMatch ? jsonMatch[1].trim() : '{}';
  const mdPlan = mdMatch ? mdMatch[1].trim() : content;

  // 创建课程记录
  const lesson = await prisma.lessonCard.create({
    data: {
      title: extractedTitle,
      classId,
      h5Json,
      mdPlan,
    },
  });

  redirect(`/lessons/${lesson.id}`);
}
````

**迁移结论**: ✅ LLM服务已在新项目中完整实现，功能等价。

### OCR服务迁移

#### 旧项目 (Python)

```python
# services/ocr_service.py
class OCRService:
    def __init__(self):
        self.mode = os.getenv("OCR_MODE", "modelscope")
        self.modelscope_token = os.getenv("MODELSCOPE_TOKEN")

    def recognize_image(self, image_path: str) -> Dict[str, Any]:
        """
        ✨ 多任务Prompt：一次调用完成姓名识别+内容提取
        """
        # 构建多任务prompt
        multi_task_prompt = '''请仔细分析这张学生作品照片，以JSON格式返回以下结构化信息：
{
  "student_name": "图片上清晰可辨的学生手写姓名",
  "work_type": "从【绘画、手工制作、文字书写、综合创作】中选择",
  "description": "用20-30字描述作品主题和内容",
  "keywords": ["核心主题词", "视觉元素", "关键概念"],
  "emotions": ["从情感列表中选择1-2个"]
}'''

        # 调用Qwen-VL
        response = self.client.chat.completions.create(
            model="Qwen/Qwen3-VL-30B-A3B-Instruct",
            messages=[{
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': multi_task_prompt},
                    {
                        'type': 'image_url',
                        'image_url': {
                            'url': f"data:image/jpeg;base64,{image_base64}"
                        }
                    }
                ]
            }],
            temperature=0.1,
        )

        # 解析JSON结果
        result_data = json.loads(raw_response)

        return {
            "success": True,
            "student_name": result_data.get("student_name", ""),
            "work_type": result_data.get("work_type", "其他"),
            "description": result_data.get("description", ""),
            "keywords": result_data.get("keywords", []),
            "emotions": result_data.get("emotions", []),
            "confidence": 0.9,
        }
```

#### 新项目 (TypeScript) - 待实现❌

按前述"缺失功能迁移清单"中的方案实现。

---

## 前端UI/UX迁移

### 主要页面对比

| 页面         | 旧项目 (Vue + Element Plus) | 新项目 (React + Tailwind)               | 迁移策略   |
| ------------ | --------------------------- | --------------------------------------- | ---------- |
| **登录页**   | LoginView.vue               | app/login/page.tsx                      | 已重写✅   |
| **仪表盘**   | DashboardView.vue           | app/dashboard/page.tsx                  | 部分完成⚠️ |
| **班级管理** | ClassManagementView.vue     | app/classes/page.tsx                    | 已完成✅   |
| **学生管理** | 在班级页内                  | app/classes/[classId]/students/page.tsx | 已完成✅   |
| **课程详情** | LessonDetailView.vue        | app/lessons/[lessonId]/page.tsx         | 三栏式✅   |
| **H5上传**   | upload.html                 | 待创建                                  | 待实现❌   |
| **归档确认** | LessonDetailView.vue内      | 待创建                                  | 待实现❌   |
| **知识库**   | 在Dashboard内               | 待创建                                  | 待实现❌   |

### 仪表盘页面迁移

#### 旧项目 (Vue)

```vue
<template>
  <div class="dashboard">
    <!-- 顶部导航 -->
    <el-header>
      <el-dropdown>
        <span>{{ username }}老师</span>
        <template #dropdown>
          <el-dropdown-item @click="logout">退出登录</el-dropdown-item>
        </template>
      </el-dropdown>
    </el-header>

    <!-- 操作栏 -->
    <el-row>
      <el-button @click="showCreateDialog = true"> + 添加新课程 </el-button>
      <el-radio-group v-model="filterStatus">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="draft">备课中</el-radio-button>
        <el-radio-button value="ready">待上课</el-radio-button>
        <el-radio-button value="archiving">待归档</el-radio-button>
        <el-radio-button value="complete">已完成</el-radio-button>
      </el-radio-group>
    </el-row>

    <!-- 课程卡片网格 -->
    <div class="lesson-grid">
      <el-card v-for="lesson in filteredLessons" :key="lesson.id" @click="goToLesson(lesson.id)">
        <h3>{{ lesson.title }}</h3>
        <el-tag :type="getStatusType(lesson.status)">
          {{ getStatusText(lesson.status) }}
        </el-tag>
        <p>{{ lesson.className }}</p>
      </el-card>
    </div>

    <!-- 创建课程对话框 -->
    <el-dialog v-model="showCreateDialog">
      <el-form>
        <el-form-item label="班级">
          <el-select v-model="classId">
            <el-option v-for="cls in classes" :key="cls.id" :label="cls.name" :value="cls.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="课程主题">
          <el-input v-model="topic" type="textarea" placeholder="如：设计一节关于友谊的班会课" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="generateLesson" :loading="generating">
          AI 生成教案
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
```

#### 新项目 (React) - 待优化⚠️

当前仪表盘已实现基本功能，但需要优化：

- [ ] 添加状态筛选（archiving, complete）
- [ ] 优化卡片展示（显示班级名称）
- [ ] 添加上传和归档快捷入口
- [ ] 添加统计信息（课程数量、学生数量）

**改进代码**:

```typescript
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const prisma = createPrismaClient();

  // 获取统计数据
  const [classes, lessons, students] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: Number(session.user.id) },
    }),
    prisma.lessonCard.findMany({
      where: {
        class: {
          teacherId: Number(session.user.id),
        },
      },
      include: { class: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.student.count({
      where: {
        class: {
          teacherId: Number(session.user.id),
        },
      },
    }),
  ]);

  // 按状态分组
  const lessonsByStatus = lessons.reduce((acc, lesson) => {
    acc[lesson.status] = (acc[lesson.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="container mx-auto py-8">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="班级数量" value={classes.length} icon="🏫" />
        <StatCard title="学生总数" value={students} icon="👥" />
        <StatCard title="课程总数" value={lessons.length} icon="📚" />
        <StatCard title="待归档课程" value={lessonsByStatus['archiving'] || 0} icon="📷" />
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2 mb-6">
        <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-primary text-white">
          全部 ({lessons.length})
        </Link>
        <Link href="/dashboard?status=draft" className="px-4 py-2 rounded-lg bg-gray-200">
          备课中 ({lessonsByStatus['draft'] || 0})
        </Link>
        <Link href="/dashboard?status=ready" className="px-4 py-2 rounded-lg bg-blue-200">
          待上课 ({lessonsByStatus['ready'] || 0})
        </Link>
        <Link href="/dashboard?status=archiving" className="px-4 py-2 rounded-lg bg-orange-200">
          待归档 ({lessonsByStatus['archiving'] || 0})
        </Link>
        <Link href="/dashboard?status=complete" className="px-4 py-2 rounded-lg bg-green-200">
          已完成 ({lessonsByStatus['complete'] || 0})
        </Link>
      </div>

      {/* 课程卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lessons.map(lesson => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            className={lesson.class.name}
          />
        ))}
      </div>
    </div>
  );
}
```

### 归档确认页面

#### 旧项目 (Vue内嵌)

```vue
<!-- 在LessonDetailView.vue内 -->
<template>
  <div class="archive-section">
    <h3>AI辅助归档</h3>

    <!-- 步骤1: 自动归档 -->
    <div v-if="autoMatched.length > 0">
      <h4>✅ 自动归档（请确认）</h4>
      <div class="upload-grid">
        <div v-for="upload in autoMatched" :key="upload.id">
          <img :src="upload.url" />
          <p>{{ upload.recognizedName }}</p>
          <el-button @click="confirmAuto(upload.id)">确认</el-button>
        </div>
      </div>
    </div>

    <!-- 步骤2: AI建议 -->
    <div v-if="pendingConfirmation.length > 0">
      <h4>🤔 AI建议（请选择）</h4>
      <div v-for="upload in pendingConfirmation" :key="upload.id">
        <img :src="upload.url" />
        <el-select v-model="upload.selectedStudentId">
          <el-option
            v-for="student in students"
            :key="student.id"
            :label="`${student.name} ${student.nickname ? '(' + student.nickname + ')' : ''}`"
            :value="student.id"
          />
        </el-select>
      </div>
    </div>

    <!-- 步骤3: 手动归档 -->
    <div v-if="pendingManual.length > 0">
      <h4>📝 手动归档</h4>
      <!-- 类似步骤2，但没有预选 -->
    </div>

    <el-button type="primary" @click="completeArchiving" :disabled="!allConfirmed">
      完成归档，开始分析
    </el-button>
  </div>
</template>
```

#### 新项目 (React) - 待实现❌

需要创建独立页面实现归档流程。

**实现代码**:

```typescript
// app/lessons/[lessonId]/archive/page.tsx
export default async function ArchivePage({
  params,
}: {
  params: { lessonId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const prisma = createPrismaClient();

  // 获取课程和上传的作品
  const [lesson, uploads, students] = await Promise.all([
    prisma.lessonCard.findUnique({
      where: { id: Number(params.lessonId) },
      include: { class: true },
    }),
    prisma.upload.findMany({
      where: {
        lessonId: Number(params.lessonId),
        triageStatus: {
          in: ['auto_matched', 'pending_confirmation', 'pending_manual'],
        },
      },
    }),
    prisma.student.findMany({
      where: {
        classId: lesson?.classId,
      },
    }),
  ]);

  if (!lesson) notFound();

  // 验证权限
  if (lesson.class.teacherId !== Number(session.user.id)) {
    redirect('/dashboard');
  }

  // 按状态分组
  const grouped = {
    autoMatched: uploads.filter(u => u.triageStatus === 'auto_matched'),
    pendingConfirmation: uploads.filter(u => u.triageStatus === 'pending_confirmation'),
    pendingManual: uploads.filter(u => u.triageStatus === 'pending_manual'),
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">
        课程归档确认：{lesson.title}
      </h1>

      {/* 步骤1: 自动归档 */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          ✅ 自动归档（{grouped.autoMatched.length}）
        </h2>
        <UploadGrid
          uploads={grouped.autoMatched}
          students={students}
          mode="auto"
        />
      </section>

      {/* 步骤2: AI建议 */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          🤔 AI建议确认（{grouped.pendingConfirmation.length}）
        </h2>
        <UploadGrid
          uploads={grouped.pendingConfirmation}
          students={students}
          mode="suggestion"
        />
      </section>

      {/* 步骤3: 手动归档 */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          📝 手动归档（{grouped.pendingManual.length}）
        </h2>
        <UploadGrid
          uploads={grouped.pendingManual}
          students={students}
          mode="manual"
        />
      </section>

      {/* 完成按钮 */}
      <form action={completeArchiving} className="text-center">
        <button
          type="submit"
          className="px-6 py-3 bg-primary text-white rounded-lg"
          disabled={uploads.length === 0}
        >
          完成归档，开始AI分析
        </button>
      </form>
    </div>
  );
}
```

### Vditor IR编辑器集成

**更新日期**: 2025-11-19
**状态**: ✅ 已完成技术验证，待正式集成到课程编辑页
**相关文件**:

- `components/vditor-editor.tsx` - Vditor编辑器组件
- `VDITOR_INTEGRATION_GUIDE.md` - 详细集成文档

#### 背景与问题

在旧项目（AIteaching）中，教案编辑器直接使用原生Markdown文本编辑，对于乡村地区教师来说，Markdown语法符号（如`##`、`**`、`-`等）造成了严重困惑。教师反映"看到这些符号不知所措"，这直接影响了产品的可用性。

#### 技术选型

经过对多个方案的研究和对比，最终选择 **Vditor** 作为解决方案：

1. **Milkdown** - 基于ProseMirror，太重（900KB+），不符合轻量级要求
2. **md-editor-rt** - 功能较好但维护滞后，漏洞多
3. **Vditor** - 完美匹配需求：
   - ✅ IR（即时渲染）模式，完全隐藏Markdown语法
   - ✅ 轻量级（核心 < 100KB）
   - ✅ 中文支持完善（开发者：Vditor中国团队）
   - ✅ 活跃维护，文档齐全
   - ✅ 支持表情、表格、代码块等丰富功能

#### 实现细节

**组件封装** (`components/vditor-editor.tsx`):

```typescript
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';

interface VditorEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  height?: string;
  readOnly?: boolean;
}

export default function VditorEditor({
  value = '',
  onChange,
  height = '600px',
  readOnly = false,
}: VditorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [vditor, setVditor] = useState<Vditor | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;

    const editor = new Vditor(editorRef.current, {
      cache: { id: 'vditor-editor' }, // 必需：缓存ID
      mode: readOnly ? 'preview' : 'ir', // IR模式 = 即时渲染
      value,
      height,
      lang: 'zh_CN',
      theme: 'classic',
      icon: 'ant',
      toolbar: [
        'emoji', 'headings', 'bold', 'italic', 'strike', '|',
        'list', 'ordered-list', 'check', 'quote', 'code', 'table', 'link', '|',
        'undo', 'redo', 'fullscreen', 'preview',
      ],
      toolbarConfig: { pin: true },
      preview: { delay: 0 },
      input: (newValue: string) => onChange?.(newValue),
      after: () => setIsReady(true),
    });

    setVditor(editor);
    return () => {
      try { editor.destroy(); } catch (e) {}
    };
  }, []);

  return (
    <div className="vditor-container">
      {!isReady && <LoadingSpinner />}
      <div ref={editorRef} />
    </div>
  );
}
```

**关键配置说明**:

| 配置项              | 值                | 说明                                   |
| ------------------- | ----------------- | -------------------------------------- |
| `cache.id`          | `'vditor-editor'` | 必需，用于本地存储缓存                 |
| `mode`              | `'ir'`            | IR模式 = Instant Rendering（即时渲染） |
| `lang`              | `'zh_CN'`         | 中文界面                               |
| `toolbar`           | 精简工具栏        | 只保留常用功能，降低学习成本           |
| `toolbarConfig.pin` | `true`            | 工具栏固定在顶部                       |

#### 集成方式

**在课程编辑页使用**:

```tsx
// app/lessons/[lessonId]/page.tsx

import VditorEditor from '@/components/vditor-editor';
import { autosaveLessonPlan } from '@/app/actions/lessons';
import { debounce } from 'lodash-es';

// 自动保存函数（防抖2秒）
const handleAutosave = debounce(async (newValue: string) => {
  const formData = new FormData();
  formData.append('lessonId', lesson.id.toString());
  formData.append('mdPlan', newValue);
  await autosaveLessonPlan(formData);
}, 2000);

// 在JSX中使用
<Card>
  <CardHeader>
    <CardTitle>教案编辑</CardTitle>
    <CardDescription>所见即所得编辑器，无需了解Markdown语法</CardDescription>
  </CardHeader>
  <CardContent className="p-0">
    <VditorEditor value={lesson.mdPlan} onChange={handleAutosave} height="600px" />
  </CardContent>
</Card>;
```

#### 当前进展

**已完成**:

- ✅ Vditor依赖安装（`pnpm add vditor`）
- ✅ 编辑器组件封装（`components/vditor-editor.tsx`）
- ✅ cache.id配置修复（解决`need options.cache.id`错误）
- ✅ 技术验证和演示页面测试
- ✅ 编写完整集成文档

**待完成**:

- ⏳ 集成到实际课程编辑页面（`app/lessons/[lessonId]/page.tsx`）
- ⏳ 测试自动保存功能
- ⏳ 移动端适配测试
- ⏳ 收集教师反馈

#### 预期效果

**对教师**:

- 零学习成本，类似Word的编辑体验
- 实时看到排版效果，不再被Markdown符号困扰
- 支持表情符号、表格等丰富内容
- 自动保存，防止内容丢失

**对系统**:

- 数据存储格式仍为Markdown，保持兼容性
- 轻量级，加载快速（适合网络环境较差的乡村地区）
- 易于维护和扩展

#### 风险与应对

| 风险                      | 可能性 | 影响 | 应对措施                           |
| ------------------------- | ------ | ---- | ---------------------------------- |
| Vditor与Next.js SSR不兼容 | 中     | 高   | 已使用'client'指令，确保客户端渲染 |
| 自动保存性能问题          | 低     | 中   | 使用lodash防抖，2秒间隔            |
| 移动端体验不佳            | 中     | 中   | Vditor内置响应式支持，需实际测试   |
| 教师不适应新界面          | 低     | 中   | 保留旧编辑器作为fallback选项       |

---

## 部署与测试计划

### 开发环境配置

#### 1. 环境变量

```bash
# .env.local
# ModelScope API
MODELSCOPE_TOKEN=your_token_here

# Cloudflare (开发用本地模拟)
NEXT_PUBLIC_CLOUDFLARE_R2_BUCKET=your-bucket
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret
CLOUDFLARE_R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com

# Database (本地SQLite)
DATABASE_URL=file:./dev.db

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
```

#### 2. 安装依赖

```bash
# 安装新依赖
npm install p-queue langchain chromadb
npm install -D @types/p-queue

# 更新Prisma
npx prisma generate
```

#### 3. 数据库迁移

```bash
# 创建新的migration
npx prisma migrate dev --name add_missing_models

# 或者手动创建migration
# cp prisma/migrations/0_init/migration.sql prisma/migrations/1_add_uploads/migration.sql
# # 编辑migration.sql添加Upload模型
```

### 测试计划

#### 单元测试

```bash
# 测试LLM调用
npm test lib/modelscope/client.test.ts

# 测试OCR解析
npm test lib/ocr/qwen-vl-client.test.ts

# 测试归档逻辑
npm test lib/upload/triage-service.test.ts
```

#### 集成测试

```bash
# 测试完整上传流程
npm test tests/upload-flow.test.ts

# 测试归档确认流程
npm test tests/archive-flow.test.ts
```

#### E2E测试 (Playwright)

```typescript
// tests/e2e/upload.spec.ts
test('complete upload and archive flow', async ({ page }) => {
  // 1. 登录
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // 2. 创建课程
  await page.click('text=+ 添加新课程');
  await page.fill('input[name="title"]', '友谊主题班会');
  await page.click('button:has-text("AI 生成教案")');

  // 3. 等待课程创建
  await page.waitForURL(/\/lessons\/\d+/);
  const lessonId = page.url().match(/\/lessons\/(\d+)/)?.[1];

  // 4. 上传作品（模拟）
  await page.goto(`/lessons/${lessonId}/upload`);

  // 5. 执行归档确认
  await page.goto(`/lessons/${lessonId}/archive`);

  // 6. 验证结果
  await expect(page.locator('text=完成归档')).toBeEnabled();
});
```

### 生产部署

#### Cloudflare Pages部署

```bash
# 1. 构建
npm run build

# 2. 部署到测试环境
npm run pages:deploy:test

# 3. 部署Worker进程（需要独立服务器或Cloudflare Workers）
# 使用Cloudflare Workers替代后台Worker进程
# scripts/ocr-worker.ts -> workers/ocr-cron.ts
```

#### Worker进程部署方案

**方案1: 独立服务器 (推荐)**

```bash
# 使用PM2运行Worker
pm2 start scripts/ocr-worker.js --name ocr-worker

# 监控日志
pm2 logs ocr-worker

# 设置开机启动
pm2 startup
pm2 save
```

**方案2: Cloudflare Workers (需要适配)**

```typescript
// workers/ocr-cron.ts
// 使用Cloudflare Workers Cron Trigger
// 每5分钟执行一次

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // 1. 连接D1数据库
    const db = env.DB;

    // 2. 查询pending uploads
    const uploads = await db
      .prepare('SELECT * FROM uploads WHERE triage_status = ? AND retry_count < 3')
      .bind('pending')
      .all();

    // 3. 处理每个upload
    for (const upload of uploads.results) {
      // 调用OCR服务（需要HTTP请求）
      // ...
    }
  },
};
```

**方案3: GitHub Actions定时任务**

```yaml
# .github/workflows/ocr-worker.yml
name: OCR Worker

on:
  schedule:
    - cron: '*/5 * * * *' # 每5分钟

jobs:
  process-uploads:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run worker:once # 执行一次处理
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          MODELSCOPE_TOKEN: ${{ secrets.MODELSCOPE_TOKEN }}
```

---

## 时间估算与里程碑

### 总体时间估算

| 阶段      | 任务                      | 时间  | 优先级 |
| --------- | ------------------------- | ----- | ------ |
| **阶段1** | 核心功能补全（上传+归档） | 2-3周 | 🔴 高  |
| **阶段2** | 内容管理与AI分析          | 1-2周 | 🟡 中  |
| **阶段3** | RAG知识库                 | 2周   | 🟡 中  |
| **阶段4** | 高级AI功能                | 2-3周 | 🟢 低  |
| **测试**  | 单元测试+集成测试         | 1周   | 🔴 高  |
| **文档**  | 文档完善与示例            | 3天   | 🟢 低  |

**总计**: 8-10周（保守估计）

### 里程碑设置

#### Milestone 1: 核心功能完整（2-3周）

**目标**: 实现旧项目P1完整功能

**交付物**:

- ✅ H5上传页面（支持批量、并发控制、防锁屏）
- ✅ OCR识别服务（Qwen3-VL）
- ✅ 三态分流归档逻辑
- ✅ 教师确认归档UI
- ✅ Worker后台进程
- ✅ 课程状态完整流转

**验收标准**:

- 可以完整执行：创建课程 → 学生上传作品 → OCR识别 → 教师归档确认 → 课程状态变为complete

#### Milestone 2: AI分析能力（1.5-2周）

**目标**: 添加AI分析报告功能

**交付物**:

- ✅ 作品聚合分析
- ✅ 班级报告生成
- ✅ 报告导出（DOCX/PDF）
- ✅ 关键词云图
- ✅ 情感分析可视化

**验收标准**:

- 归档完成后可查看AI生成的班级报告
- 报告包含：作品统计、关键词、情感分析、教学建议

#### Milestone 3: 知识库增强（2周）

**目标**: 实现RAG知识库

**交付物**:

- ✅ 文档上传解析（PDF/DOCX/PPTX）
- ✅ ChromaDB向量存储集成
- ✅ RAG增强的AI备课
- ✅ 知识库管理界面

**验收标准**:

- 可上传教学文档到知识库
- AI备课时会参考知识库内容
- 生成的教案包含参考文献

#### Milestone 4: 高级功能（可选，2-3周）

**目标**: 实现P2高级功能

**交付物**:

- ✅ 多模型融合分析
- ✅ AI主动推荐
- ✅ 学期成长报告
- ✅ 班级情绪雷达图

**验收标准**:

- 分析报告包含视觉理解（色彩、主体）
- 系统主动推送教学建议
- 可生成学期个人/班级报告

### 进度跟踪

使用GitHub Projects或Notion进行进度跟踪：

```
项目看板：
📋 Backlog（待办）
   └─ P2高级功能

🚧 In Progress（进行中）
   └─ 阶段1: H5上传页面
   └─ 阶段1: OCR服务

✅ Done（已完成）
   └─ 基础项目搭建
   └─ 用户认证系统
   └─ 班级管理
   └─ 学生管理
   └─ AI教案生成
   └─ 课程编辑器
   └─ 文件上传
```

---

## 风险与应对策略

### 🔴 高风险

#### 风险1: OCR识别准确率低

**影响**: 归档功能不可用

**概率**: 中（小学生手写体识别困难）

**应对**:

1. **开发前验证**（必须提前测试）
   - 准备10-20张真实小学生作业照片
   - 测试Qwen3-VL识别准确率
   - 评估可用性

2. **降级方案**
   - 如果准确率 < 50%: 放弃AI识别，纯手动归档
   - 如果准确率 50-70%: 增加更多人工确认环节
   - 如果准确率 > 70%: 按原计划实现

3. **备选方案**
   - 使用专业OCR服务（如阿里云、腾讯云OCR）
   - 训练专用模型（需要数据和算力）

#### 风险2: Worker进程部署困难

**影响**: OCR无法自动处理

**概率**: 中（Cloudflare Pages限制）

**应对**:

1. **方案A: Cloudflare Workers**（推荐）
   - 使用Cron Trigger定时执行
   - 适配Worker运行时
   - 限制每次处理数量（防止超时）

2. **方案B: GitHub Actions**
   - 定时触发（每5分钟）
   - 执行一次处理任务
   - 最长运行6小时

3. **方案C: Supabase Edge Functions**
   - 使用Supabase托管
   - 类似Cloudflare Workers
   - 支持定时任务

### 🟡 中风险

#### 风险3: RAG知识库效果不佳

**影响**: AI备课质量提升不明显

**概率**: 中

**应对**:

1. **优化文档解析**
   - 使用更好的解析库（Tika替代PyPDF2）
   - 优化文本分块策略
   - 清理格式和噪音

2. **优化检索**
   - 调整embedding模型
   - 优化top-k和相似度阈值
   - 添加重排序（reranking）

3. **Prompt工程**
   - 优化RAG prompt模板
   - 添加引用标记
   - 增强上下文融合

#### 风险4: 多模型融合复杂度高

**影响**: P2功能延期

**概率**: 中

**应对**:

1. **简化方案**
   - 初期只使用Qwen-VL（单一模型）
   - 后续逐步添加更多模型

2. **异步处理**
   - 将分析任务拆分为多个步骤
   - 每个步骤独立重试
   - 提高系统稳定性

### 🟢 低风险

#### 风险5: 性能问题

**影响**: 响应慢、超时

**概率**: 低

**应对**:

- 添加API超时设置（30秒）
- 使用CDN加速静态资源
- 优化数据库查询（添加索引）
- 使用Redis缓存（如果需要）

#### 风险6: 成本控制

**影响**: ModelScope API费用

**概率**: 低（单日2000次免费额度充足）

**应对**:

```typescript
// 添加API调用计数
let apiCallCount = 0;

export async function callModelScopeChat(messages: ChatMessage[]) {
  apiCallCount++;
  console.log(`[API Call #${apiCallCount}]`);

  // 检查配额
  if (apiCallCount > 1800) {
    console.warn('接近每日配额限制！');
  }

  // ...调用API...
}
```

---

## 附录

### 附录A: 核心API清单

```
认证相关:
- POST /api/auth/login
- GET /api/auth/me
- POST /api/register

班级管理:
- POST /api/classes
- GET /api/classes
- GET /api/classes/[classId]
- PUT /api/classes/[classId]
- DELETE /api/classes/[classId]

学生管理:
- POST /api/classes/[classId]/students
- GET /api/classes/[classId]/students
- PUT /api/students/[studentId]
- DELETE /api/students/[studentId]

课程管理:
- POST /api/lessons/generate
- GET /api/lessons
- GET /api/lessons/[lessonId]
- PUT /api/lessons/[lessonId]
- DELETE /api/lessons/[lessonId]
- POST /api/lessons/[lessonId]/ready
- POST /api/lessons/[lessonId]/archive

文件上传:
- POST /api/upload (签名URL)
- GET /api/upload?key=xxx&signature=xxx (下载)

作品管理 (待实现):
- POST /api/uploads/signed
- GET /api/uploads/lesson/[lessonId]
- PATCH /api/uploads/[uploadId]/triage
- GET /api/uploads/[uploadId]

内容版本 (待实现):
- POST /api/contents
- PUT /api/contents/[contentId]
- GET /api/contents/[contentId]/history

知识库 (待实现):
- POST /api/knowledge/documents
- GET /api/knowledge/search
- DELETE /api/knowledge/documents/[docId]

报告 (待实现):
- GET /api/reports/lesson/[lessonId]
- GET /api/reports/student/[studentId]
- GET /api/reports/semester
```

### 附录B: 环境变量配置

```bash
# .env.local

# ModelScope API
MODELSCOPE_TOKEN=your_modelscope_token_here

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_generated_secret

# Database (Cloudflare D1)
DATABASE_URL=your_d1_database_url

# Cloudflare R2
NEXT_PUBLIC_CLOUDFLARE_R2_BUCKET=your_bucket_name
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com

# Cloudflare KV (用于限流)
CLOUDFLARE_KV_NAMESPACE=your_kv_namespace

# Optional: ChromaDB (RAG)
CHROMADB_PATH=./chroma_db
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5

# Worker配置
WORKER_POLL_INTERVAL=5000  # 5秒
WORKER_MAX_RETRY=3
```

### 附录C: Prompt模板

#### LLM教案生成Prompt (v1.7)

````
### "心灵微光"首席教育专家 (Prompt v1.7)

**角色 (Role):** "心灵微光"首席教育专家

**注意 (Attention):**
1. 你的核心使命是扮演"AI副班主任"，为（特别是乡村的）K-9教师赋能。
2. 你必须时刻牢记"分层适配"：产出内容必须严格对应 **{grade_level}** 学生的认知水平。这是架构的核心。
3. 你的所有产出都是结构化的，旨在直接注入"心灵微光"工作台的前后端。

**性格类型指标 (MBTI):** INFJ (倡导者)
* 解释：既有对学生心理的深刻洞察 (I, N, F)，又有强大的规划和组织能力 (J)，完美契合"减轻教师负担，点亮心灵微光"的使命。

**背景 (Background):**
你是一名融合了多重身份的资深教育专家：
* **经验丰富的班主任：** 深刻理解乡村K-9中小学的日常教学和班级管理挑战。
* **心理健康专家：** 极其擅长**班会、心理、德育**等"非主科"课程，深刻理解不同年龄段学生的心理发展规律。
* **教案设计大师：** 能够编写科学、清晰、合理且内容翔实的教案。

**约束条件 (Constraints):**
1. **年级优先 (Grade-First):** 当前班级年级是 **{grade_level}**，你必须严格基于此年级进行设计。
2. **主题聚焦：** 核心服务范围是**班会、心理健康、德育**课程。
3. **双重产出 (Dual Output):** 必须一次性生成两种格式的产出：
   * **产出A (H5演示数据包)：** 用于课堂电子白板演示的结构化内容（JSON格式）
   * **产出B (详细可打印教案)：** 用于教师的详细Markdown教案

**技能 (Skills):**
1. **核心·分层适配 (Stratified Adaptation):** 根据"{grade_level}"的认知特点，在教学目标、语言风格、活动难度、主题深度上做出精准调整。
2. **心理洞察 (Psychological Insight):** 深刻理解该年龄段学生的心理发展特征。
3. **结构化输出 (Structured Output):** 精通生成H5演示数据包(JSON)和详细教案(Markdown)。

**音调 (Tone):**
* **专业 (Professional):** 基于教育学和心理学原理
* **共情 (Empathetic):** 温暖、有爱，体现"心灵微光"的理念
* **务实 (Pragmatic):** 提供乡村教师可落地、低负担的方案
* **可靠 (Reliable):** 如同一位经验丰富、值得信赖的"AI副班主任"

###

**当前任务：** 为 **{grade_level}** 学生设计一节{topic}课程

**Self-Correction (内部思考):**
请先进行内部推理（可以输出思考过程）：
1. {grade_level}学生的认知特点是什么？
2. 如何将"{topic}"具体化为该年龄段能理解的内容？
3. 什么样的活动形式最适合这个年龄段？（小学低年级：绘本、游戏、唱歌；小学高年级：讨论、角色扮演；初中：思辨、辩论）

**产出要求：**
请生成三个部分：

1. **课程标题**（简洁有力，10字以内）：
   - 必须符合{grade_level}学生的理解力
   - 要吸引学生注意力

2. **H5演示数据包**（JSON格式）：
   - 用于课堂电子白板全屏播放
   - 包含5-8张幻灯片
   - 每张幻灯片必须清晰标注类型和内容
   - 支持文字、图片、互动环节
   - 适合翻页笔操作

3. **详细教案**（Markdown格式，3000-5000字）：
   必须包含完整结构：
   - **一、教学目标** (3-5条，符合{grade_level}认知水平)
   - **二、教学重难点** (明确重点和难点)
   - **三、课前准备** (教具、材料清单)
   - **四、详细教学步骤** (3-5个环节，每个环节包含时间分配、教师活动、学生活动)
   - **五、互动活动设计** (至少2个，适合{grade_level}年龄段)
   - **六、课堂总结与反思** (总结方式、延伸思考)

**关键分层适配原则：**
- 小学低年级（1-2年级）：具象化、游戏化、避免抽象概念
- 小学中年级（3-4年级）：故事引导、小组活动、初步思考
- 小学高年级（5-6年级）：讨论交流、角色体验、价值引导
- 初中（7-9年级）：思辨性、自主探究、深度对话

**输出格式（严格遵守）：**

```title
课程标题（10字以内）
````

```json
{{
  "h5_data": {{
    "slides": [
      {{
        "type": "title",
        "content": "课程标题",
        "subtitle": "副标题（可选）"
      }},
      // ...
    ]
  }}
}}
```

```markdown
# {grade_level}德育课教案：[课程标题]

## 一、教学目标

1. ...
```

请现在开始设计，充分发挥你作为"{grade_level}专家"的洞察力！

```

#### OCR多任务Prompt
```

请仔细分析这张学生作品照片，以JSON格式返回以下结构化信息：
{
"student_name": "图片上清晰可辨的学生手写姓名，如果没有则返回空字符串",
"work_type": "从【绘画、手工制作、文字书写、综合创作】中选择最符合的一项",
"description": "用20-30字具体描述作品的主题、内容和视觉特征",
"text_content": "按阅读顺序识别图片中出现的所有文字内容",
"keywords": ["作品核心主题词", "主要视觉元素", "表达的关键概念"],
"emotions": ["从【快乐、温馨、思念、感恩、自豪、期待、创意、努力】中选择最贴切的1-2个"]
}

分析指导：

1. 如果是绘画作品：描述画面主体、色彩特点、绘画风格
2. 如果是手工作品：描述材料、制作工艺、造型特点
3. 如果是文字作品：描述字体风格、文字排版、内容主题
4. 情感判断：基于画面氛围、色彩选择、文字内容综合判断

返回要求：

- 只返回标准JSON格式，不要添加任何解释文字
- 确保所有字段都有值（如没有则返回空字符串或空数组）
- 关键词要具体、准确，避免过于抽象的词汇
- 情感标签必须是从给定列表中选择

```

### 附录D: 参考资料

- [旧项目完整代码](https://github.com/your-org/AIteaching)
- [Next.js文档](https://nextjs.org/docs)
- [ModelScope文档](https://modelscope.cn/docs)
- [Prisma文档](https://www.prisma.io/docs)
- [Tailwind CSS文档](https://tailwindcss.com/docs)
- [Cloudflare Developer Docs](https://developers.cloudflare.com/)

---

## 文档更新历史

| 版本 | 日期 | 作者 | 变更内容 |
|-----|------|------|---------|
| v1.0 | 2025-11-19 | Claude Code | 初始版本，完整迁移方案 |
| | | | |

---

**下一步行动**:
1. 确认方案可行性和时间计划
2. 启动阶段1开发（H5上传页面）
3. 准备测试数据集（真实学生作业照片）
4. OCR准确率验证测试

**联系信息**:
- 项目仓库: https://github.com/your-org/edge-next-starter
- 部署地址: https://your-project.pages.dev
```
