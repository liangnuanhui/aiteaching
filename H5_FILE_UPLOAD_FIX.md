# H5文件上传路径修复总结

## 问题描述

H5课件编辑器上传的图片和视频无法在播放器中显示。

## 根本原因

`app/api/upload/route.ts` 在第71行使用了硬编码的 `uploads/` 前缀:

```typescript
const key = `uploads/${filename}`; // ❌ 错误
```

这导致文件被保存到 `/uploads/uploads/` (重复路径),因为:

1. `lib/storage/index.ts` 的 `LocalStorage` 使用 `./uploads` 作为 `basePath`
2. 路径拼接: `join('./uploads', 'uploads/xxx.mp4')` = `'./uploads/uploads/xxx.mp4'`

## 修复方案

### 1. 修改上传API路径前缀

**文件**: `app/api/upload/route.ts:71`

```typescript
// 修改前
const key = `uploads/${filename}`;

// 修改后
const key = `h5/${filename}`;
```

**优势**:

- 清晰区分文件类型 (`h5/` vs `lesson_{id}/`)
- 符合项目路径规范
- 便于后续管理和备份

### 2. 迁移现有文件

```bash
mkdir -p uploads/h5
mv uploads/uploads/* uploads/h5/
rmdir uploads/uploads
```

**迁移文件**:

- 1763703727964-Kimi 砍价战绩.jpg (135 KB)
- 1763704534402-Kimi 砍价战绩.jpg (135 KB)
- 1763704576250-browserleaks-webrtc-2025_11_20_21_11_18.png (286 KB)
- 1763704682242-cursorful-video-1763352829885.mp4 (16.4 MB)

### 3. 更新数据库中的URL引用

**文件**: `scripts/fix-h5-urls.mjs`

```javascript
// 为lesson_cards表的h5_json中的本地文件添加正确的URL
slide.url = `/api/storage/local/h5/${actualFilename}`;
```

**更新结果**:

- Slide 11 (图片): `/api/storage/local/h5/1763704576250-browserleaks-webrtc-2025_11_20_21_11_18.png`
- Slide 12 (视频): `/api/storage/local/h5/1763704682242-cursorful-video-1763352829885.mp4`

## 最终文件结构

```
uploads/
├── h5/                              # H5课件媒体文件
│   ├── 1763703727964-xxx.jpg
│   ├── 1763704534402-xxx.jpg
│   ├── 1763704576250-xxx.png
│   └── 1763704682242-xxx.mp4
├── lesson_19/                       # 学生作品
│   └── [学生作品文件]
└── lesson_21/                       # 学生作品
    └── [学生作品文件]
```

## 最佳实践

### 本地开发

- **存储方式**: 本地文件系统 (`./uploads/`)
- **访问路径**: `/api/storage/local/{key}`
- **配置**: 环境变量 `LOCAL_UPLOAD_DIR` (默认 `./uploads`)

### 生产部署

#### Cloudflare Pages

- **存储方式**: Cloudflare R2 (自动检测切换)
- **访问路径**: `/api/storage/r2/{key}`
- **配置**: R2 bucket 绑定 (通过 wrangler.toml)

#### VPS部署

- **存储方式**: 本地文件系统或对象存储
- **访问路径**: `/api/storage/local/{key}` 或 `/api/storage/r2/{key}`
- **配置**:
  - `STORAGE_TYPE=local` (使用本地)
  - `STORAGE_TYPE=r2` (使用R2)
  - `STORAGE_TYPE=auto` (自动检测,默认)

### 路径规范

**推荐的key格式**:

- H5课件媒体: `h5/{timestamp}-{filename}`
- 学生作品: `lesson_{lessonId}/{timestamp}-{filename}`
- OCR临时文件: `ocr/{timestamp}-{filename}`
- 报告文件: `reports/{reportId}/{filename}`

**实现示例**:

```typescript
// app/api/upload/route.ts
const key = `h5/${filename}`;

// app/api/lesson-upload/route.ts
const key = `lesson_${lessonId}/${filename}`;
```

## 文件访问流程

### 上传流程

1. 前端上传文件到 `/api/upload` 或 `/api/lesson-upload`
2. API接收文件,生成key (如 `h5/xxx.mp4`)
3. Storage层保存文件到 `./uploads/h5/xxx.mp4` (本地) 或 R2 (生产)
4. API返回 `storageUrl`: `/api/storage/local/h5/xxx.mp4`

### 访问流程

1. H5编辑器保存 `storageUrl` 到数据库的 `h5_json`
2. H5播放器读取 `url` 字段: `/api/storage/local/h5/xxx.mp4`
3. 请求 `/api/storage/local/h5/xxx.mp4`
4. `app/api/storage/local/[...key]/route.ts` 解析key: `h5/xxx.mp4`
5. Storage层读取文件: `join('./uploads', 'h5/xxx.mp4')` = `./uploads/h5/xxx.mp4`
6. 返回文件内容

## 代码健壮性保证

### 1. 路径规范化

- ✅ 不在key中包含 `uploads/` 前缀
- ✅ Storage层统一处理basePath拼接
- ✅ 支持本地和R2的无缝切换

### 2. 环境自动检测

```typescript
// lib/storage/index.ts
export function createStorage(): IStorage | null {
  const storageType = process.env.STORAGE_TYPE || 'auto';

  if (storageType === 'auto') {
    if (env?.BUCKET) {
      return new R2Storage(env.BUCKET); // 生产环境
    } else {
      return new LocalStorage(uploadDir); // 开发环境
    }
  }
}
```

### 3. 错误处理

- ✅ 文件不存在返回404
- ✅ Storage不可用返回500
- ✅ 上传失败自动回滚

## 测试验证

### 功能测试

1. ✅ 访问 http://localhost:3000/lessons/22 - 页面加载
2. ✅ 图片显示正常 (slide 11)
3. ✅ 视频播放正常 (slide 12)
4. ✅ H5编辑器上传新文件 - 保存到 `uploads/h5/`
5. ✅ 学生作品上传 - 保存到 `uploads/lesson_{id}/` (不受影响)

### 路径验证

```bash
# 检查文件结构
ls -la uploads/h5/

# 检查数据库URL
sqlite3 prisma/dev.db "SELECT json_extract(h5_json, '$.h5_data.slides[10].url') FROM lesson_cards WHERE id = 22;"

# 测试文件访问
curl http://localhost:3000/api/storage/local/h5/1763704682242-cursorful-video-1763352829885.mp4 -I
```

## 后续优化建议

### P2优先级

1. **路径工具类** (`lib/storage/paths.ts`):

   ```typescript
   export const STORAGE_PATHS = {
     H5_MEDIA: 'h5',
     STUDENT_WORK: 'lesson',
     OCR_TEMP: 'ocr',
   } as const;
   ```

2. **文件清理任务**: 定期删除临时文件和孤儿文件

3. **CDN集成**: 生产环境使用CDN加速静态文件访问

### P3优先级

1. **图片优化**: 自动生成缩略图和多尺寸版本
2. **视频转码**: 统一视频格式和码率
3. **存储监控**: 文件大小、数量、访问频率监控

## 修改文件清单

| 文件                      | 修改内容                   | 状态    |
| ------------------------- | -------------------------- | ------- |
| `app/api/upload/route.ts` | 第71行: `uploads/` → `h5/` | ✅ 完成 |
| `uploads/` 目录           | 迁移文件到 `h5/` 子目录    | ✅ 完成 |
| `prisma/dev.db`           | 更新lesson_cards的h5_json  | ✅ 完成 |
| `scripts/fix-h5-urls.mjs` | 创建数据库更新脚本         | ✅ 完成 |

## 部署注意事项

### VPS部署

```bash
# 1. 确保uploads目录存在
mkdir -p /var/www/app/uploads/h5

# 2. 设置正确的权限
chown -R www-data:www-data /var/www/app/uploads

# 3. 环境变量配置
LOCAL_UPLOAD_DIR=/var/www/app/uploads
STORAGE_TYPE=local
```

### Cloudflare部署

```bash
# 1. 创建R2 bucket
wrangler r2 bucket create xin-ling-wei-guang-uploads

# 2. 绑定到Pages项目 (wrangler.toml)
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "xin-ling-wei-guang-uploads"

# 3. 迁移本地文件到R2 (可选)
wrangler r2 object put xin-ling-wei-guang-uploads/h5/xxx.mp4 --file=uploads/h5/xxx.mp4
```

## 总结

本次修复解决了H5文件上传路径重复的问题,通过:

1. 修改上传API使用正确的key格式
2. 迁移现有文件到新路径
3. 更新数据库中的URL引用

代码现在遵循统一的路径规范,支持本地开发和生产部署的无缝切换,具有良好的扩展性和健壮性。

**测试链接**: http://localhost:3000/lessons/22

---

_Last updated: 2025-11-22_
_Fix version: 1.0.0_
_Status: ✅ Complete_
