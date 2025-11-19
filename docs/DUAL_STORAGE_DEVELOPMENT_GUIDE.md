# 学生作品上传功能 - 本地开发指南

**文档版本**: v1.0
**创建日期**: 2025-11-19
**适用范围**: 本地开发环境（无缝支持后续云端部署）

---

## 📋 目录

- [架构设计](#架构设计)
- [环境准备](#环境准备)
- [开发步骤](#开发步骤)
- [测试验证](#测试验证)
- [部署到云端](#部署到云端)
- [注意事项](#注意事项)

---

## 架构设计

### 核心思路：抽象存储接口

为了解决本地开发和云端部署的兼容性问题，我们采用**抽象存储接口**设计：

```
┌─────────────────┐
│   业务代码层     │ (app/api/upload, components/upload)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  存储抽象层      │ (lib/storage/index.ts) ← 你在这里开发
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌─────────┐
│ 本地文件 │ │   R2    │
│  系统    │ │ 存储    │
└─────────┘ └─────────┘
  (开发用)    (部署用)
```

### 关键优势

1. **零代码修改**: 业务代码无需改动，通过配置切换存储方式
2. **自动检测**: 没有R2环境自动使用本地文件系统
3. **完全一致**: API返回值格式相同，前端无需适配
4. **无缝迁移**: 部署时只需修改环境变量

---

## 环境准备

### 1. 安装依赖

```bash
# pnpm已经安装的依赖（无需额外安装）
# - prisma (数据库ORM)
# - vditor (编辑器)
# - 其他依赖已在package.json中

# 如果没有node_modules，先安装
pnpm install
```

### 2. 环境变量配置（重要）

创建或更新 `.env.local` 文件：

```bash
# ==================== 本地开发配置 ====================

# 数据库配置（Prisma会自动使用本地文件数据库）
# 无需配置，自动fallback到./prisma/dev.db

# 存储配置
# 可选值: 'auto' | 'local' | 'r2'
# auto: 自动检测（优先R2，没有就用本地）
# local: 强制使用本地文件系统
# r2: 强制使用R2（会报错如果R2不可用）
STORAGE_TYPE=auto

# 本地存储目录（默认./uploads）
LOCAL_UPLOAD_DIR=./uploads

# Max file size (10MB)
MAX_FILE_SIZE=10485760

# ModelScope API（需要AI功能时配置）
MODELSCOPE_TOKEN=your_token_here

# NextAuth配置
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-here
```

**特别提醒**：`STORAGE_TYPE=auto` 是最推荐的模式，开发时自动用本地，部署到Cloudflare时自动用R2。

### 3. 数据库准备

```bash
# 1. 确保prisma schema已配置（应该已经有了）
# 检查 prisma/schema.prisma

# 2. 生成Prisma Client
pnpm prisma generate

# 3. 创建/更新本地数据库
# 注意：如果之前已经运行过，可以跳过此步骤
pnpm prisma db push

# 4. （可选）查看数据库内容
pnpm prisma studio
```

---

## 开发步骤

### 第一步：创建H5Uploader组件

**文件**: `components/upload/h5-uploader.tsx`

```bash
# 创建upload目录
mkdir -p components/upload
```

复制以下内容到文件：

```typescript
'use client';

import { useState, useRef } from 'react';
import { UploadService } from '@/services/upload.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ImageIcon, UploadIcon, XIcon } from 'lucide-react';
import Image from 'next/image';

interface H5UploaderProps {
  lessonId: number;
}

export function H5Uploader({ lessonId }: H5UploaderProps) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    setFiles(selectedFiles);

    // 生成预览URL
    const urls = Array.from(selectedFiles).map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  // 处理上传
  const handleUpload = async () => {
    if (!files || files.length === 0) {
      alert('请选择文件');
      return;
    }

    setIsUploading(true);

    try {
      // 1. 上传到R2/本地存储
      const uploadResults = await UploadService.uploadFiles(files);

      // 2. 保存到数据库
      await saveStudentWorks(uploadResults, lessonId);

      // 3. 更新UI状态
      setUploadedFiles(uploadResults);

      alert(`上传成功！共${uploadResults.length}个文件`);

      // 清空选择
      setFiles(null);
      setPreviewUrls([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败，请检查控制台');
    } finally {
      setIsUploading(false);
    }
  };

  // 保存学生作品到数据库
  async function saveStudentWorks(uploadResults: any[], lessonId: number) {
    const formData = new FormData();
    formData.append('lessonId', lessonId.toString());
    formData.append('works', JSON.stringify(uploadResults));

    const response = await fetch('/api/student-works', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to save student works');
    }

    return await response.json();
  }

  // 清除选择
  const clearSelection = () => {
    setFiles(null);
    setPreviewUrls([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* 上传区域 */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
        <Input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {previewUrls.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer"
          >
            <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">点击选择或拖拽文件到此处</p>
            <p className="text-xs text-gray-500">支持 JPG、PNG、PDF 格式</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {previewUrls.map((url, idx) => {
              const file = files?.[idx];
              const isImage = file?.type.startsWith('image/');

              return (
                <div key={idx} className="relative group">
                  {isImage ? (
                    <Image
                      src={url}
                      alt={`预览 ${idx + 1}`}
                      width={150}
                      height={150}
                      className="rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-32 bg-gray-100 rounded-lg">
                      <ImageIcon className="h-10 w-10 text-gray-400" />
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {file?.name}
                  </p>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      URL.revokeObjectURL(url);
                      const newFiles = Array.from(files || []).filter((_, i) => i !== idx);
                      const newUrls = previewUrls.filter((_, i) => i !== idx);
                      setFiles(newFiles.length > 0 ? createFileList(newFiles) : null);
                      setPreviewUrls(newUrls);
                    }}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <Button
          onClick={handleUpload}
          disabled={isUploading || !files || files.length === 0}
          className="flex-1"
        >
          {isUploading ? (
            <>
              <span className="animate-spin">⏳</span>
              上传中...
            </>
          ) : (
            '开始上传'
          )}
        </Button>

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          重新选择
        </Button>

        {previewUrls.length > 0 && (
          <Button
            variant="ghost"
            onClick={clearSelection}
            disabled={isUploading}
          >
            清空
          </Button>
        )}
      </div>

      {/* 已上传文件 */}
      {uploadedFiles.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">已上传文件</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {uploadedFiles.map((file, idx) => (
              <Card key={idx} className="overflow-hidden">
                <CardContent className="p-2">
                  {file.contentType?.startsWith('image/') ? (
                    <Image
                      src={file.url}
                      alt="已上传"
                      width={100}
                      height={100}
                      className="w-full h-20 object-cover rounded"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-20 bg-gray-100 rounded">
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 辅助函数：创建FileList（浏览器兼容）
function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));
  return dataTransfer.files;
}
```

**注意**：这个组件实现了完整的上传流程：

1. 文件选择和预览
2. 上传到存储（R2/本地）
3. 保存到数据库
4. 显示上传结果

### 第二步：创建学生作品数据库表

编辑 `prisma/schema.prisma`：

```prisma
// 在文件末尾添加

model StudentWork {
  id          Int      @id @default(autoincrement())
  lessonId    Int
  lesson      LessonCard @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  // 文件信息
  fileKey     String   // 存储的key（R2路径或本地文件名）
  fileUrl     String   // 访问URL
  fileName    String   // 原始文件名
  fileSize    Int      // 文件大小（字节）
  contentType String?  // MIME类型

  // OCR识别状态
  ocrStatus   String   @default("pending") // pending | processing | completed | failed
  ocrText     String?  // 识别的文字内容

  // AI分析结果
  analysisStatus String @default("pending") // pending | completed | failed
  analysisResult Json? // AI分析结果（类型、关键词、情感等）

  // 归档状态
  archiveStatus String @default("pending") // pending | auto-matched | needs-review | confirmed

  // 关联学生（通过OCR或AI识别）
  studentId   Int?
  student     Student? @relation(fields: [studentId], references: [id], onDelete: SetNull)
  confidence  Float?   // 匹配置信度

  // 上传信息
  uploadedBy  String?  // 上传者标识
  uploadedAt  Int      // Unix timestamp

  // 元数据
  metadata    Json?    // 额外元数据

  // 索引
  @@index([lessonId])
  @@index([studentId])
  @@index([ocrStatus])
  @@index([analysisStatus])
  @@index([archiveStatus])
}
```

**执行数据库迁移**：

```bash
# 1. 生成Prisma Client（如果schema更新了）
pnpm prisma generate

# 2. 应用数据库变更
pnpm prisma db push

# 3. （可选）查看数据库GUI
pnpm prisma studio
```

**验证**：

```bash
# 检查数据库文件是否存在
ls -lh prisma/dev.db

# 应该能看到数据库文件
```

### 第三步：创建学生作品API

**文件**: `app/api/student-works/route.ts`

```bash
# 创建目录
mkdir -p app/api/student-works
```

创建API文件：

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPrismaClient } from '@/lib/db/client';
import { MissingRequiredFieldError, AuthenticationError } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * POST /api/student-works
 * 保存学生作品到数据库
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证登录
    const session = await auth();
    if (!session?.user?.id) {
      throw new AuthenticationError('请先登录');
    }

    const userId = parseInt(session.user.id);
    const formData = await request.formData();

    // 2. 获取参数
    const lessonId = parseInt(formData.get('lessonId') as string);
    const worksJson = formData.get('works') as string;

    if (!lessonId || isNaN(lessonId)) {
      throw new MissingRequiredFieldError('lessonId');
    }

    if (!worksJson) {
      throw new MissingRequiredFieldError('works');
    }

    const works = JSON.parse(worksJson);

    // 3. 验证课程归属（确保是当前用户创建的课程）
    const prisma = createPrismaClient();
    const lesson = await prisma.lessonCard.findFirst({
      where: {
        id: lessonId,
        class: {
          teacherId: userId,
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: '无权限操作此课程' }, { status: 403 });
    }

    // 4. 创建学生作品记录
    const now = Math.floor(Date.now() / 1000);
    const createdWorks = await Promise.all(
      works.map((work: any) =>
        prisma.studentWork.create({
          data: {
            lessonId,
            fileKey: work.key,
            fileUrl: work.url,
            fileName: work.name || work.key,
            fileSize: work.size || 0,
            contentType: work.contentType || 'application/octet-stream',
            uploadedBy: `h5-scanner`, // 标记为H5扫码上传
            uploadedAt: now,
            ocrStatus: 'pending', // 等待OCR处理
            analysisStatus: 'pending', // 等待AI分析
            archiveStatus: 'pending', // 等待归档
          },
        })
      )
    );

    // 5. 返回成功
    return NextResponse.json({
      success: true,
      data: createdWorks,
      message: `成功保存 ${createdWorks.length} 个作品`,
    });
  } catch (error) {
    console.error('保存学生作品失败:', error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof MissingRequiredFieldError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/student-works?lessonId=xxx
 * 获取某个课程的所有学生作品
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AuthenticationError('请先登录');
    }

    const userId = parseInt(session.user.id);
    const searchParams = request.nextUrl.searchParams;
    const lessonId = parseInt(searchParams.get('lessonId') || '');

    if (!lessonId || isNaN(lessonId)) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 });
    }

    const prisma = createPrismaClient();

    // 验证课程归属
    const lesson = await prisma.lessonCard.findFirst({
      where: {
        id: lessonId,
        class: {
          teacherId: userId,
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: '无权限查看此课程' }, { status: 403 });
    }

    // 获取学生作品
    const works = await prisma.studentWork.findMany({
      where: { lessonId },
      include: {
        student: true, // 包含学生信息（如果已关联）
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: works,
      count: works.length,
    });
  } catch (error) {
    console.error('获取学生作品失败:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 第四步：创建上传目录

```bash
# 在项目根目录创建上传目录
mkdir uploads

# 添加到.gitignore（不要提交上传的文件）
echo "/uploads/" >> .gitignore
echo "*.db" >> .gitignore
echo "prisma/dev.db" >> .gitignore
```

---

## 测试验证

### 启动开发服务器

```bash
# 1. 清除缓存
rm -rf .next

# 2. 启动开发服务器
pnpm dev

# 服务器将在 http://localhost:3001 启动
```

### 测试上传页面

1. **访问测试上传页面**

   ```
   http://localhost:3001/upload
   ```

   - 选择任意文件上传
   - 查看返回的URL
   - 点击URL预览文件

   **预期结果**：文件应该成功上传并可以访问

2. **访问课程上传页面**

   ```
   http://localhost:3001/lessons/1/upload
   ```

   - 如果没有课程ID 1，先到 `/dashboard` 创建一个课程
   - 然后访问课程详情页，URL类似 `/lessons/19`
   - 手动修改URL，添加 `/upload`，如 `/lessons/19/upload`

3. **测试上传学生作品**
   - 选择多个图片文件
   - 点击"开始上传"
   - 查看上传进度和预览

   **预期结果**：
   - ✅ 文件上传成功
   - ✅ 显示预览缩略图
   - ✅ 文件保存在 `./uploads/` 目录

### 验证数据库

```bash
# 方式1: 使用Prisma Studio
pnpm prisma studio

# 方式2: 直接查看数据库文件
sqlite3 prisma/dev.db "SELECT * FROM StudentWork;"
```

**预期结果**：

- 表 `StudentWork` 已成功创建
- 上传的文件记录已插入数据库
- `fileUrl` 字段指向正确的URL

### 验证存储

```bash
# 查看上传目录
ls -lh uploads/

# 预期输出示例:
# -rw-r--r--  1 user  staff   2.3M 11 19 15:30 1732009830000-image1.jpg
# -rw-r--r--  1 user  staff   1.8M 11 19 15:30 1732009835000-document.pdf
```

---

## 部署到云端

### 步骤1: 配置Cloudflare R2

1. **创建R2 bucket**
   - 登录 Cloudflare Dashboard
   - 进入 R2 Object Storage
   - 创建 Bucket，命名为 `student-works`

2. **获取R2访问密钥**
   - R2 Settings → Manage R2 API Tokens
   - 创建 Token，保存 `Access Key ID` 和 `Secret Access Key`

### 步骤2: 配置D1数据库

1. **创建D1数据库**
   - Cloudflare Dashboard → D1
   - 创建数据库，命名为 `ai-teaching-db`

2. **设置Wrangler配置**

   更新 `wrangler.toml`：

   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "ai-teaching-db"
   database_id = "your-database-id"

   [[r2_buckets]]
   binding = "BUCKET"
   bucket_name = "student-works"
   ```

### 步骤3: 配置环境变量

在Cloudflare Pages/Workers的配置中添加：

```bash
# 生产环境变量
STORAGE_TYPE=r2  # 强制使用R2存储
NODE_ENV=production
MODELSCOPE_TOKEN=your_production_token
NEXTAUTH_SECRET=your_production_secret
```

### 步骤4: 部署

```bash
# 1. 推送数据库schema
pnpm prisma db push

# 2. 部署到Cloudflare
pnpm deploy

# 或使用Wrangler
wrangler deploy
```

### 步骤5: 数据迁移（可选）

如果需要将本地数据迁移到云端：

```bash
# 1. 导出本地数据
sqlite3 prisma/dev.db .dump > backup.sql

# 2. 使用Wrangler导入到D1
wrangler d1 execute ai-teaching-db --file=backup.sql
```

---

## 注意事项

### 1. 文件存储限制

**本地开发**: `./uploads` 目录会保存所有上传文件

- 定期清理：`rm -rf uploads/*`
- 添加到 `.gitignore`

**生产环境**: R2 bucket 会自动管理文件

- 设置生命周期规则自动清理
- 无需手动管理

### 2. 路由说明

| 路由                                  | 用途               | 环境   |
| ------------------------------------- | ------------------ | ------ |
| `POST /api/upload`                    | 上传文件           | 所有   |
| `GET /api/upload?key=xxx`             | 下载文件（带签名） | 所有   |
| `GET /api/storage/local/:key`         | 本地文件访问       | 仅本地 |
| `POST /api/student-works`             | 保存学生作品       | 所有   |
| `GET /api/student-works?lessonId=xxx` | 获取作品列表       | 所有   |

### 3. 调试技巧

```bash
# 查看存储类型
# 在终端运行：
node -e "console.log('STORAGE_TYPE:', process.env.STORAGE_TYPE || 'auto')"

# 查看上传目录
ls -lah uploads/

# 查看数据库内容
pnpm prisma studio

# 实时查看日志
pnpm dev | grep -E "(storage|upload)"
```

### 4. 常见问题

**问题1**: `Storage not available`

- **原因**: 存储未初始化
- **解决**: 检查 `lib/storage/index.ts` 是否正确导入

**问题2**: `File not found` (上传成功但无法访问)

- **原因**: 本地文件路由错误
- **解决**: 检查 `app/api/storage/local/route.ts` 是否正确

**问题3**: 上传的文件找不到

- **原因**: 目录不存在
- **解决**: 创建 `./uploads` 目录

```bash
mkdir uploads
```

**问题4**: 数据库表不存在

- **原因**: Prisma schema未同步
- **解决**:

```bash
pnpm prisma generate
pnpm prisma db push
```

### 5. 性能考虑

- **本地存储**: 适合开发，但大量文件会影响Git仓库大小
- **R2存储**: 生产推荐，CDN加速，无限容量
- **自动清理**: 建议为R2设置生命周期规则

```bash
# R2生命周期规则示例（自动删除30天前的文件）
{
  "rules": [
    {
      "id": "delete-old-uploads",
      "enabled": true,
      "conditions": {
        "age": 30
      },
      "actions": {
        "delete": true
      }
    }
  ]
}
```

---

## 总结

通过抽象存储接口，你可以：

1. **现在**: 完全本地开发，无需R2和D1
2. **保持**: 代码无需改动，100%复用
3. **未来**: 一键切换到云端服务

**关键文件**: `lib/storage/index.ts` → 这是整个方案的核心

---

**下一步**: 开始按照上面的步骤实现上传功能吧！🚀
