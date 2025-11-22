# H5课件本地视频显示优化

## 问题描述

H5课件播放器显示本地上传的视频时,会在视频下方显示文件名(如 `cursorful-video-1763352829885.mp4`),影响美观性和用户体验。

**期望效果**: 本地上传的视频应该像外部视频链接一样,居中显示,不显示文件名。

## 根本原因

1. **数据存储**: H5编辑器上传文件时,将文件名保存到slide的 `description` 字段
2. **渲染逻辑**: 播放器会显示所有视频的 `description`,包括本地上传文件的文件名
3. **文件名格式**: 本地上传的文件名格式为 `{timestamp}-{原始文件名}.{扩展名}`
   - 例: `1763704682242-cursorful-video-1763352829885.mp4`

## 解决方案

### 修改文件

`components/lesson-h5-player.tsx`

### 1. 添加文件名识别函数 (第66-74行)

```typescript
/**
 * 判断description是否为本地上传的文件名格式
 * 格式: 时间戳-原始文件名.扩展名 (如: 1763704682242-xxx.mp4)
 */
function isLocalUploadFilename(description: string): boolean {
  if (!description) return false;
  // 匹配以13位时间戳开头,后跟连字符和文件名的格式
  return /^\d{13}-.*\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|mov|avi|flv|pdf)$/i.test(description);
}
```

**识别规则**:

- 以13位时间戳开头 (如 `1763704682242`)
- 连字符 `-`
- 任意文件名
- 文件扩展名 (支持常见图片/视频/文档格式)

### 2. 优化视频显示逻辑 (第368-409行)

#### 修改前

```typescript
<div className="mt-4 flex justify-center">
  <video ... />
  {current.description && videoInfo?.isSupported && (
    <div className="mt-3 text-sm text-muted-foreground">
      {current.description}  {/* ❌ 会显示文件名 */}
    </div>
  )}
</div>
```

#### 修改后

```typescript
<div className="mt-4">
  <div className="flex justify-center">
    <video ... />
  </div>
  {/* ✅ 过滤掉文件名格式的description */}
  {current.description &&
    videoInfo?.isSupported &&
    !isLocalUploadFilename(current.description) && (
      <div className="mt-3 text-center text-sm text-muted-foreground">
        {current.description}
      </div>
    )}
</div>
```

**关键改进**:

1. ✅ 添加 `!isLocalUploadFilename(current.description)` 判断
2. ✅ 只显示有意义的描述文本,过滤文件名
3. ✅ 改为 `text-center` 居中对齐,与外部视频样式一致
4. ✅ 调整容器结构,视频和描述分开布局

### 3. 图片显示同步优化 (第355-367行)

为保持一致性,图片描述也应用相同逻辑:

```typescript
{/* 对于本地上传的图片(文件名格式),不显示description */}
{current.description && !isLocalUploadFilename(current.description) && (
  <div className="mt-3 text-sm text-muted-foreground">{current.description}</div>
)}
```

## 效果对比

### 修改前

```
┌─────────────────────────┐
│                         │
│   [视频播放器]          │
│                         │
└─────────────────────────┘
cursorful-video-1763352829885.mp4  ❌ 显示文件名
```

### 修改后

```
┌─────────────────────────┐
│                         │
│   [视频播放器]          │
│                         │
└─────────────────────────┘
                                   ✅ 不显示文件名
```

### 外部视频(有自定义描述)

```
┌─────────────────────────┐
│                         │
│   [视频播放器]          │
│                         │
└─────────────────────────┘
       瑞士风景 4K          ✅ 显示自定义描述
```

## 影响范围

### ✅ 受益场景

1. **本地上传的视频** - 不再显示长文件名,界面更简洁
2. **本地上传的图片** - 同样不显示文件名
3. **外部视频链接** - 继续显示自定义描述文本

### ✅ 不受影响

1. **外部视频平台** (B站/YouTube等) - 继续正常显示
2. **自定义描述** - 用户手动输入的描述仍会显示
3. **其他幻灯片类型** - 文本/活动等类型不受影响

## 文件名格式示例

会被识别为文件名(不显示)的格式:

- ✅ `1763704682242-cursorful-video-1763352829885.mp4`
- ✅ `1763704576250-browserleaks-webrtc-2025_11_20_21_11_18.png`
- ✅ `1763703727964-Kimi 砍价战绩.jpg`

不会被识别为文件名(继续显示)的格式:

- ❌ `瑞士风景` (无扩展名)
- ❌ `youtube视频 4k风景` (无时间戳)
- ❌ `dream car` (普通文本)

## 测试验证

### 测试步骤

1. 启动开发服务器: `pnpm dev`
2. 访问: http://localhost:3000/lessons/22
3. 点击"开始放映"进入全屏模式
4. 使用方向键切换到第12张幻灯片(本地上传的视频)

### 预期结果

- ✅ 视频播放器居中显示
- ✅ 视频下方不显示文件名
- ✅ 布局简洁美观,与外部视频一致

### 兼容性测试

- ✅ 外部视频(B站/YouTube)正常播放
- ✅ 自定义描述文本正常显示
- ✅ 图片幻灯片正常显示

## 代码健壮性

### 边界情况处理

1. **description为空**: `isLocalUploadFilename` 返回 `false`,不影响逻辑
2. **description为undefined**: 条件判断短路,不会调用函数
3. **非标准格式**: 正则匹配失败,返回 `false`,保留原有显示逻辑

### 性能影响

- ✅ 轻量级正则匹配,性能影响可忽略
- ✅ 仅在渲染时执行一次,无性能问题

## 后续优化建议

### P2优先级

1. **编辑器改进**: 上传文件时允许用户输入自定义描述

   ```typescript
   // 替代文件名的自定义描述
   description: '项目演示视频'; // 而不是 "1763704682242-demo.mp4"
   ```

2. **缩略图预览**: 为本地视频生成缩略图,改善预览体验

### P3优先级

1. **文件管理**: 提供文件重命名功能
2. **批量编辑**: 批量修改多个幻灯片的描述

## 总结

本次优化通过智能识别本地上传文件的文件名格式,自动隐藏无意义的文件名显示,使H5课件播放器的视觉效果更加专业和美观,同时保持了对自定义描述文本的完整支持。

**关键改进**:

- ✅ 本地上传文件不显示文件名
- ✅ 视频播放器居中布局
- ✅ 与外部视频样式统一
- ✅ 保持向后兼容

**修改文件**:

- `components/lesson-h5-player.tsx` (添加辅助函数 + 优化渲染逻辑)

**测试链接**: http://localhost:3000/lessons/22

---

_Last updated: 2025-11-22_
_Optimization version: 1.0.0_
_Status: ✅ Complete_
