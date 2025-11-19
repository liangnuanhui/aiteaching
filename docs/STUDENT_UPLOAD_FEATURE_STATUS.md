# 学生作品上传功能 - 开发进度与计划

**文档版本**: v1.0  
**创建日期**: 2025-11-19  
**当前状态**: 框架完成，核心组件待实现

---

## 📊 当前进度总览

### ✅ 已完成部分（30%）

#### 1. 基础设施层（100%）

- ✅ **数据库抽象层** (`lib/db/client.ts`)
  - ✅ D1数据库集成（Cloudflare生产环境）
  - ✅ 本地文件数据库fallback（开发环境）
  - ✅ Prisma ORM集成

- ✅ **存储抽象层** (`lib/storage/index.ts`) **【刚完成】**
  - ✅ LocalStorage适配器（本地文件系统）
  - ✅ R2Storage适配器（Cloudflare R2）
  - ✅ 自动检测和切换机制
  - ✅ 统一的存储接口

- ✅ **上传API** (`app/api/upload/route.ts`)
  - ✅ 文件上传端点（支持单文件和多文件）
  - ✅ 文件下载端点（带签名URL）
  - ✅ 文件大小限制（10MB）
  - ✅ Rate limiting（防滥用）

- ✅ **测试上传页面** (`app/upload/page.tsx`)
  - ✅ 完整的上传UI
  - ✅ 文件预览（图片、音频、视频）
  - ✅ 上传状态显示

#### 2. 页面框架（50%）

- ✅ **课程上传页框架** (`app/lessons/[lessonId]/upload/page.tsx`)
  - ✅ 页面路由和参数处理
  - ✅ 课程信息加载和验证
  - ✅ UI布局（待填充组件）

---

### ❌ 未完成部分（70%）

#### 3. 核心组件（0%）

- ❌ **H5Uploader组件** (`components/upload/h5-uploader.tsx`)
  - ❌ 文件选择和预览
  - ❌ 批量上传
  - ❌ 上传进度显示
  - ❌ 结果预览

#### 4. 数据库层（0%）

- ❌ **StudentWork模型** (`prisma/schema.prisma`)
  - ❌ 学生作品表结构
  - ❌ OCR状态字段
  - ❌ AI分析结果字段
  - ❌ 归档状态字段

#### 5. API层（0%）

- ❌ **学生作品API** (`app/api/student-works/route.ts`)
  - ❌ POST创建记录
  - ❌ GET查询列表
  - ❌ 权限验证

#### 6. AI功能（0%）

- ❌ **OCR识别** (`app/api/ocr/route.ts`)
  - ❌ Qwen3-VL集成
  - ❌ 手写体识别
  - ❌ 学生姓名提取

- ❌ **AI辅助归档** (`app/api/archive/ai-suggest/route.ts`)
  - ❌ 作品-学生匹配算法
  - ❌ 置信度计算
  - ❌ 三态分流（自动/建议/手动）

#### 7. 前端功能（0%）

- ❌ **AI归档确认页** (`app/lessons/[lessonId]/archive/page.tsx`)
  - ❌ 自动归档确认
  - ❌ AI建议选择
  - ❌ 手动匹配

- ❌ **作品内容分析** (`components/archive/analysis-view.tsx`)
  - ❌ 类型识别（绘画/写作/手工）
  - ❌ 关键词提取
  - ❌ 情感分析

---

## 🎯 后续开发计划

### 阶段1：基础上传功能（2-3小时）

**目标**: 学生能够通过H5扫码上传作品，文件保存到存储并与课程关联

#### 任务1.1: 创建H5Uploader组件

**文件**: `components/upload/h5-uploader.tsx`

```typescript
// 实现步骤：
// 1. 文件选择和预览
// 2. 批量上传支持
// 3. 上传进度显示
// 4. 上传结果展示

// 核心功能：
- 支持多文件选择（图片、PDF）
- 文件预览（缩略图）
- 批量上传（并行/串行）
- 上传状态跟踪
- 错误处理
- 清除选择
```

**预计时间**: 45分钟

**参考代码**: 见 `docs/DUAL_STORAGE_DEVELOPMENT_GUIDE.md` 第一步

---

#### 任务1.2: 添加StudentWork数据库模型

**文件**: `prisma/schema.prisma`

```prisma
// 添加内容：
model StudentWork {
  id          Int      @id @default(autoincrement())
  lessonId    Int
  lesson      LessonCard @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  // 文件信息
  fileKey     String   // R2路径或本地文件名
  fileUrl     String   // 访问URL
  fileName    String   // 原始文件名
  fileSize    Int      // 文件大小
  contentType String?  // MIME类型

  // OCR结果
  ocrStatus   String   @default("pending")
  ocrText     String?  // 识别的姓名

  // AI分析
  analysisStatus String @default("pending")
  analysisResult Json? // {type, keywords, sentiment}

  // 归档状态
  archiveStatus String @default("pending") // auto-matched | needs-review | confirmed

  // 学生关联
  studentId   Int?
  student     Student? @relation(fields: [studentId], references: [id], onDelete: SetNull)
  confidence  Float?   // 匹配置信度

  uploadedBy  String?  // 上传者标识
  uploadedAt  Int      // Unix时间戳

  @@index([lessonId])
  @@index([studentId])
  @@index([ocrStatus])
  @@index([archiveStatus])
}
```

**执行命令**:

```bash
pnpm prisma generate
pnpm prisma db push
```

**预计时间**: 15分钟

---

#### 任务1.3: 创建学生作品API

**文件**: `app/api/student-works/route.ts`

```typescript
// 实现端点：
// 1. POST /api/student-works - 创建作品记录
// 2. GET /api/student-works?lessonId=xxx - 查询课程作品

// 核心逻辑：
- 验证登录
- 验证课程归属（防止越权）
- 批量创建数据库记录
- 关联课程ID
```

**验证方式**:

```bash
# 测试API
curl -X POST /api/student-works \
  -F "lessonId=1" \
  -F 'works=[{"key":"uploads/123.jpg","url":"/api/storage/local/uploads/123.jpg","name":"作品1","size":1024}]'
```

**预计时间**: 30分钟

**参考代码**: 见 `docs/DUAL_STORAGE_DEVELOPMENT_GUIDE.md` 第三步

---

#### 任务1.4: 创建上传目录

```bash
mkdir uploads
echo "/uploads/" >> .gitignore
echo "*.db" >> .gitignore
```

**预计时间**: 2分钟

---

#### 任务1.5: 测试基础上传

1. 启动服务器: `pnpm dev`
2. 访问课程上传页: `http://localhost:3001/lessons/1/upload`
3. 选择文件上传
4. 验证:
   - ✅ 文件保存在 `./uploads/`
   - ✅ 数据记录在 `prisma/dev.db`
   - ✅ 预览显示正确

**预计时间**: 10分钟

---

### **阶段1完成标准**

- ✅ 学生可以通过扫码访问 `/lessons/:id/upload`
- ✅ 能够批量上传图片/PDF
- ✅ 文件保存在存储中（本地或R2）
- ✅ 数据库记录StudentWork表
- ✅ 上传后显示预览缩略图

---

### 阶段2：OCR识别功能（2-3小时）

**目标**: 自动识别学生作品中的姓名信息，匹配合适的学生

#### 任务2.1: 创建OCR API端点

**文件**: `app/api/ocr/route.ts`

```typescript
// 功能要求：
// 1. 接收图片URL
// 2. 调用Qwen3-VL模型
// 3. 识别手写姓名
// 4. 返回识别结果和置信度

// 核心逻辑：
- ModelScope API集成（已封装在lib/modelscope）
- 手写体识别专用prompt
- 结果解析，提取姓名
- 置信度计算
```

**预计时间**: 45分钟

**参考**: 旧项目 `AIteaching/app/api/v1/ocr/upload.py`

---

#### 任务2.2: 集成OCR到上传流程

**修改文件**: `components/upload/h5-uploader.tsx`

```typescript
// 在上传完成后：
// 1. 对每个文件调用OCR API
// 2. 更新数据库的ocrText字段
// 3. 显示OCR识别结果

// 新增功能：
-上传后自动触发OCR - OCR结果展示 - 手动修正识别结果;
```

**预计时间**: 30分钟

---

#### 任务2.3: 创建OCR状态管理

**文件**: `app/actions/ocr.ts` 或 `lib/ocr/processor.ts`

```typescript
// 功能：
// 1. OCR任务队列（防止并发过多）
// 2. 重试机制（失败重试3次）
// 3. 进度跟踪

// 核心算法：
- 使用bullmq或简单setTimeout队列
- exponential backoff重试
- WebSocket通知（可选）
```

**预计时间**: 45分钟

---

#### 任务2.4: 测试OCR功能

1. 上传带手写姓名的测试图片
2. 验证识别结果
3. 测试失败场景

**预计时间**: 20分钟

---

### **阶段2完成标准**

- ✅ OCR自动识别学生姓名
- ✅ 识别结果保存到数据库
- ✅ 显示OCR识别界面
- ✅ 支持手动修正

---

### 阶段3：AI辅助归档（3-4小时）

**目标**: 实现三态分流（自动匹配/AI建议/手动归档）

#### 任务3.1: 实现学生匹配算法

**文件**: `lib/archive/matcher.ts`

```typescript
// 三态分流逻辑：
// 1. 自动匹配：OCR置信度 > 90% 且姓名完全匹配
// 2. AI建议：置信度 70-90%，提供2-3个候选
// 3. 手动归档：置信度 < 70% 或无法识别

// 算法：
-基于编辑距离的模糊匹配 - 考虑班级学生名单 - 计算置信度分数;
```

**预计时间**: 45分钟

**参考**: 旧项目 `AIteaching/app/api/v1/lessons/:id/ocr/match`

---

#### 任务3.2: 创建AI建议API

**文件**: `app/api/archive/ai-suggest/route.ts`

```typescript
// 输入: lessonId, workId
// 输出: { suggestions: [{studentId, name, confidence, reason}] }

// 逻辑：
- 获取班级学生列表
- 与ocrText匹配
- 返回Top 3建议
- 附置信度和理由
```

**预计时间**: 30分钟

---

#### 任务3.3: 创建归档确认页

**文件**: `app/lessons/[lessonId]/archive/page.tsx`

```typescript
// 页面结构：
// 1. 三栏展示
//   - 左侧：自动匹配（待确认）
//   - 中间：AI建议（待选择）
//   - 右侧：手动归档（待填写）

// 功能：
- 批量确认自动匹配
- 选择AI建议的学生
- 手动输入学生姓名（支持下拉选择）
- 提交归档
```

**预计时间**: 90分钟

---

#### 任务3.4: 创建归档Action

**文件**: `app/actions/archive.ts`

```typescript
// 功能：
// 1. 更新studentWork记录（studentId, archiveStatus）
// 2. 生成归档日志
// 3. 触发AI分析（下一个阶段）

// 验证：
-验证教师权限 - 验证课程归属 - 防止重复归档;
```

**预计时间**: 30分钟

---

#### 任务3.5: 测试归档流程

1. 上传多张测试图片（手写不同学生姓名）
2. 访问归档页面: `/lessons/1/archive`
3. 测试三种场景：
   - 自动匹配确认
   - AI建议选择
   - 手动归档
4. 验证数据库状态变更

**预计时间**: 30分钟

---

### **阶段3完成标准**

- ✅ 三态分流正确分类所有上传作品
- ✅ 自动匹配准确率 > 80%
- ✅ AI建议界面友好，支持选择
- ✅ 手动归档支持模糊搜索学生
- ✅ 归档状态更新到数据库

---

### 阶段4：作品内容分析（2-3小时）

**目标**: AI分析作品类型、提取关键词、情感分析

#### 任务4.1: 实现内容分析API

**文件**: `app/api/analyze/work/route.ts`

```typescript
// 输入: workId（学生作品ID）
// 功能：
// 1. 作品类型识别（绘画/写作/手工/书法）
// 2. 关键词提取
// 3. 情感分析（积极/中性/消极）
// 4. 生成分析报告

// 返回: { type, keywords[], sentiment, summary }
```

**预计时间**: 60分钟

**参考**: 旧项目 `AIteaching/app/api/v1/lessons/:id/analyze`

---

#### 任务4.2: 集成到归档流程

**归档后触发**：

```typescript
// 在确认归档后：
// 1. 调用分析API
// 2. 更新analysisResult字段
// 3. 在归档页面显示分析结果
```

**预计时间**: 30分钟

---

#### 任务4.3: 创建分析报告组件

**文件**: `components/archive/analysis-result.tsx`

```typescript
// 展示：
// - 作品类型（图标+文字）
// - 关键词标签
// - 情感分数（彩色进度条）
// - AI摘要
```

**预计时间**: 45分钟

---

### **阶段4完成标准**

- ✅ AI能正确识别作品类型（准确率>85%）
- ✅ 关键词提取合理
- ✅ 情感分析符合预期
- ✅ 分析报告可视化展示

---

### 阶段5：分享与展示（1-2小时）

**目标**: 支持H5分享，让家长查看学生作品

#### 任务5.1: 创建作品分享页

**文件**: `app/share/works/[workId]/page.tsx`

```typescript
// 功能：
// - 公开访问（无需登录）
// - 展示作品图片
// - 显示分析结果
// - 显示学生姓名（部分隐藏保护隐私）
```

**预计时间**: 45分钟

---

#### 任务5.2: 生成分享二维码

**集成到**: `app/lessons/[lessonId]/archive/page.tsx`

```typescript
// 每个作品生成二维码
// = http://yourdomain.com/share/works/:workId

// 使用库：qrcode.react
```

**预计时间**: 15分钟

---

### **阶段5完成标准**

- ✅ 作品可以公开分享（带签名URL）
- ✅ 移动端适配良好
- ✅ 隐私保护（姓名部分隐藏）

---

## 📈 总体进度估算

| 阶段     | 功能         | 预计时间      | 优先级 |
| -------- | ------------ | ------------- | ------ |
| 1        | 基础上传     | 2-3小时       | **高** |
| 2        | OCR识别      | 2-3小时       | 高     |
| 3        | AI归档       | 3-4小时       | **高** |
| 4        | 内容分析     | 2-3小时       | 中     |
| 5        | 分享展示     | 1-2小时       | 低     |
| **总计** | **完整功能** | **10-15小时** | -      |

**建议分3-5天完成**:

- Day 1: 阶段1（基础上传）
- Day 2: 阶段2-3（OCR + AI归档）
- Day 3: 阶段4（内容分析）
- Day 4: 阶段5（分享） + 测试

---

## 📝 开发注意事项

### 1. 数据格式规范

**StudentWork表**:

```typescript
interface StudentWork {
  id: number; // 作品ID
  lessonId: number; // 课程ID
  fileKey: string; // R2路径或本地文件名
  fileUrl: string; // 访问URL
  fileName: string; // 原始文件名
  fileSize: number; // 文件大小（字节）
  contentType?: string; // MIME类型

  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed'; // OCR状态
  ocrText?: string; // 识别的姓名

  analysisStatus: 'pending' | 'completed' | 'failed'; // 分析状态
  analysisResult?: {
    // AI分析
    type: string; // 作品类型
    keywords: string[]; // 关键词
    sentiment: string; // 情感
    summary: string; // 摘要
  };

  archiveStatus: 'pending' | 'auto-matched' | 'needs-review' | 'confirmed'; // 归档状态

  studentId?: number; // 关联学生ID
  confidence?: number; // 匹配置信度（0-100）

  uploadedBy?: string; // 上传者标识
  uploadedAt: number; // Unix时间戳
}
```

### 2. 文件命名规范

```typescript
// 格式: {timestamp}-{original-filename}-{random}.ext
// 示例: 1732012345678-小明_作文.jpg-a1b2c3

const timestamp = Date.now();
const random = Math.random().toString(36).substring(2, 8);
const key = `uploads/${timestamp}-${file.name}-${random}`;
```

### 3. URL签名机制

```typescript
// 本地开发: 直接访问
/api/storage/local/{key}

// 生产环境: 带签名URL（1小时过期）
/api/upload?key={key}&signature={sig}&expires={timestamp}

// 前端无需关心，storage层自动处理
```

### 4. 错误处理

**上传失败**:

- 网络错误：重试3次
- 文件过大：提示用户压缩
- 格式不支持：提示重新选择

**OCR失败**:

- 图片模糊：提示重新拍摄
- 无法识别：标记为手动归档

**匹配失败**:

- 学生不在名单：提示添加学生
- 姓名不匹配：进入AI建议流程

### 5. 性能优化

**上传**:

- 限制并发数（3-5个同时上传）
- 显示上传进度
- 支持取消上传

**OCR**:

- 队列处理（防止API限流）
- 失败重试（指数退避）
- 异步处理（无需等待）

**数据库**:

- 批量插入（减少查询次数）
- 索引优化（加快查询）
- 软删除（便于恢复）

---

## 🎯 本周开发目标

### 本周完成（优先级排序）:

1. **周一**: 阶段1 - 基础上传功能
   - [ ] H5Uploader组件
   - [ ] StudentWork数据库表
   - [ ] 学生作品API
   - [ ] 基础上传测试

2. **周二**: 阶段2 - OCR识别功能
   - [ ] OCR API端点
   - [ ] OCR集成到上传流程
   - [ ] OCR状态管理
   - [ ] OCR测试

3. **周三**: 阶段3 - AI辅助归档
   - [ ] 学生匹配算法
   - [ ] AI建议API
   - [ ] 归档确认页
   - [ ] 归档Action

4. **周四**: 阶段4 - 内容分析
   - [ ] 作品分析API
   - [ ] 归档后触发分析
   - [ ] 分析报告组件

5. **周五**: 阶段5 - 分享功能 + 测试
   - [ ] 作品分享页
   - [ ] 二维码生成
   - [ ] 端到端测试

**每日结束标准**: 当天功能可用，代码提交Git

---

## ❓ 常见问题

### Q1: 上传的文件在哪里？

**A**:

- 本地开发: `./uploads/` 目录
- 生产环境: Cloudflare R2 bucket

### Q2: 数据库文件在哪里？

**A**: `prisma/dev.db` (SQLite文件)

### Q3: 如何重置测试数据？

**A**:

```bash
# 删除上传文件
rm -rf uploads/*

# 重置数据库
rm prisma/dev.db
pnpm prisma db push
```

### Q4: OCR识别不准确怎么办？

**A**:

- 检查图片清晰度
- 检查手写是否工整
- 手动修正识别结果
- 调优prompt（见 `lib/modelscope/prompts.ts`）

### Q5: 学生匹配失败怎么办？

**A**:

- 确认学生已在班级名单中
- 检查OCR识别结果
- 使用手动归档
- 检查置信度阈值

---

## 📚 参考文档

- **核心文档**: `docs/DUAL_STORAGE_DEVELOPMENT_GUIDE.md` - 本地开发完整指南
- **数据库文档**: `prisma/schema.prisma` - 数据模型定义
- **AIteaching迁移方案**: `AIteaching升级迁移方案.md` - 功能对照表
- **Vditor集成指南**: `VDITOR_INTEGRATION_GUIDE.md` - 编辑器集成（如需要）

---

## ✅ 提交检查清单

**每个阶段完成后，检查以下项**:

- [ ] 代码已提交到Git
- [ ] 数据库schema已更新（如果需要）
- [ ] README已更新（新增API文档）
- [ ] 功能已测试（至少手动测试一次）
- [ ] 无编译错误
- [ ] 无运行时错误

---

## 🎉 完成功能演示

**最终用户流程**:

1. **教师**: 创建课程 → 发布作业
2. **学生**: 扫码访问 `/lessons/:id/upload` → 拍照上传作品
3. **系统**:
   - ✅ 接收文件
   - ✅ OCR识别姓名
   - ✅ AI匹配合适学生
   - ✅ 通知教师归档确认
4. **教师**:
   - 查看归档建议
   - 确认或修改匹配
   - AI自动生成分析报告
5. **家长**: 扫码查看报告

---

**Next Action**: 开始实现 **阶段1 - 任务1.1** (H5Uploader组件) 🚀
