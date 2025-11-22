# Wrangler迁移历史修复总结

## 问题描述

Wrangler D1迁移系统报错 "no such table: uploads",原因是:

- 0003_add_multi_model_fields.sql 尝试修改uploads表
- 但uploads表及其他核心业务表(classes, students, lesson_cards等)从未通过迁移文件创建
- 这些表最初是通过 `prisma db push` 直接创建的,未记录在迁移历史中

## 根本原因

Wrangler的本地D1数据库(`.wrangler/state/v3/d1`)与Prisma的本地SQLite数据库(`prisma/dev.db`)是**两个独立的数据库**:

| 数据库             | 路径                    | 创建方式         | 状态          |
| ------------------ | ----------------------- | ---------------- | ------------- |
| **Prisma本地库**   | `prisma/dev.db`         | `prisma db push` | ✅ 包含所有表 |
| **Wrangler本地D1** | `.wrangler/state/v3/d1` | 迁移文件         | ❌ 缺少业务表 |

**迁移历史断层**:

```
0001_init.sql (users, posts) ✅
0002_auth_tables.sql (accounts, sessions) ✅
--- 缺失: classes, students, lesson_cards, uploads, reports表创建 ---
0003_add_multi_model_fields.sql (ALTER uploads) ❌ 失败
```

## 解决方案

### 1. 重新组织迁移文件

```bash
# 原有迁移:
0001_init.sql
0002_auth_tables.sql
0003_add_multi_model_fields.sql  # ❌ ALTER uploads失败

# 重新组织后:
0001_init.sql
0002_auth_tables.sql
0003_create_app_tables.sql       # ✅ 新增: 创建缺失的表
0004_add_multi_model_fields.sql  # ✅ 重命名: 现在可以成功ALTER
```

### 2. 创建基线迁移 (0003_create_app_tables.sql)

新创建的迁移文件包含以下表的完整定义:

**核心业务表**:

- `classes` - 班级表(含索引: teacher_id, grade_level)
- `students` - 学生表(含索引: class_id, name)
- `lesson_cards` - 课程卡片表(含索引: class_id, lesson_group_id, status)
- `lesson_contents` - 课程内容表
- `uploads` - 学生作品上传表(含索引: lesson_id, student_id, file_hash, triage_status)
- `reports` - 报告表(含唯一索引: lesson_id)

**表关系**:

```
users (teacher)
  ↓
classes
  ↓
students
  ↓
lesson_cards
  ↓
uploads → reports
```

### 3. 应用迁移到Wrangler本地D1

```bash
# 检查待应用的迁移
pnpm wrangler d1 migrations list cloudflare-worker-template-local --local
# 显示: 0003_create_app_tables.sql, 0004_add_multi_model_fields.sql

# 应用迁移
pnpm wrangler d1 migrations apply cloudflare-worker-template-local --local
# 结果: ✅ 26条命令成功执行

# 验证迁移状态
pnpm wrangler d1 migrations list cloudflare-worker-template-local --local
# 显示: ✅ No migrations to apply!
```

## 修复结果

### ✅ 本地开发环境

- **Prisma本地库** (`prisma/dev.db`): 包含所有表和数据 ✅
- **Wrangler本地D1**: 包含完整表结构 ✅
- **迁移历史**: 完整记录所有表创建 ✅

### ✅ 生产部署就绪

现在迁移历史完整,可以安全部署到:

- **Cloudflare Pages + D1**: 直接应用所有迁移
- **VPS环境**: 使用Prisma迁移或Wrangler迁移均可

## 迁移文件清单

| 文件名                                       | 描述                 | 状态      |
| -------------------------------------------- | -------------------- | --------- |
| `migrations/0001_init.sql`                   | 初始化users和posts表 | ✅ 已应用 |
| `migrations/0002_auth_tables.sql`            | NextAuth认证表       | ✅ 已应用 |
| `migrations/0003_create_app_tables.sql`      | **新增**: 核心业务表 | ✅ 已应用 |
| `migrations/0004_add_multi_model_fields.sql` | 多模型字段(原0003)   | ✅ 已应用 |

## 文件修改记录

### 新增文件

- `migrations/0003_create_app_tables.sql` (4838 bytes)
  - 创建classes, students, lesson_cards, lesson_contents, uploads, reports表
  - 创建所有必要的索引和外键约束

### 重命名文件

- `migrations/0003_add_multi_model_fields.sql` → `migrations/0004_add_multi_model_fields.sql`

## 验证检查清单

### ✅ 迁移系统

- [x] 所有迁移文件按顺序编号
- [x] Wrangler本地D1无待应用迁移
- [x] 迁移历史记录完整

### ✅ 数据库表结构

- [x] 所有核心表存在于Wrangler D1
- [x] 外键约束正确
- [x] 索引创建成功

### ✅ 多模型字段

- [x] uploads表包含model_consensus字段
- [x] uploads表包含model_count字段
- [x] uploads表包含4个教育专业字段

## 部署指南

### Cloudflare Pages部署

```bash
# 1. 确保本地迁移测试通过
pnpm wrangler d1 migrations list cloudflare-worker-template-local --local
# 输出: ✅ No migrations to apply!

# 2. 创建生产D1数据库(如果尚未创建)
pnpm wrangler d1 create cloudflare-worker-template-production

# 3. 更新wrangler.toml绑定生产数据库
# [[d1_databases]]
# binding = "DB"
# database_name = "cloudflare-worker-template-production"
# database_id = "xxx"

# 4. 应用迁移到生产数据库
pnpm wrangler d1 migrations apply cloudflare-worker-template-production --remote

# 5. 部署Pages项目
pnpm pages:deploy:prod
```

### VPS部署 (使用Prisma)

```bash
# 1. 设置环境变量
DATABASE_URL=file:./prod.db

# 2. 生成Prisma Client
pnpm prisma generate

# 3. 推送schema到数据库
pnpm prisma db push

# 或使用Prisma迁移(如果有Prisma迁移文件)
pnpm prisma migrate deploy
```

## 测试验证

### 本地测试

```bash
# 1. 启动开发服务器
pnpm dev

# 2. 测试功能
# - 创建班级 ✅
# - 添加学生 ✅
# - 生成课程 ✅
# - 上传作品 ✅
# - OCR识别 ✅
# - 归档确认 ✅
# - 生成报告 ✅
```

### 迁移测试

```bash
# 在干净的环境中测试迁移
rm -rf .wrangler/state
pnpm wrangler d1 migrations apply cloudflare-worker-template-local --local
# 预期: 4个迁移文件全部成功应用
```

## 后续优化建议

### P1 (立即处理)

- [x] 修复Wrangler迁移历史 - **已完成**
- [ ] 在Cloudflare生产环境测试迁移

### P2 (重要)

- [ ] 建立迁移规范:所有schema变更必须通过迁移文件
- [ ] 添加迁移回滚脚本(down migrations)
- [ ] 迁移前备份数据库

### P3 (优化)

- [ ] 统一Prisma迁移和Wrangler迁移工作流
- [ ] 自动化迁移测试
- [ ] 迁移版本控制策略

## 经验教训

### ❌ 避免

1. **不要混用 `prisma db push` 和迁移文件** - 导致迁移历史断层
2. **不要在生产环境直接执行schema变更** - 必须通过迁移文件
3. **不要忽略Wrangler和Prisma数据库的差异** - 它们是独立的

### ✅ 最佳实践

1. **所有schema变更通过迁移文件** - 确保历史完整
2. **本地测试迁移** - 在 `.wrangler` 环境中验证
3. **迁移文件按序编号** - 便于版本控制
4. **生产部署前验证** - 测试环境完整测试迁移

## 总结

本次修复通过创建基线迁移文件,补全了Wrangler迁移历史中缺失的核心业务表,解决了:

1. ✅ **迁移失败问题** - 不再报"no such table: uploads"错误
2. ✅ **迁移历史完整** - 所有表创建都有迁移记录
3. ✅ **生产部署就绪** - 可以安全部署到Cloudflare或VPS
4. ✅ **开发环境一致** - Wrangler和Prisma数据库结构一致

现在项目的迁移系统健康,可以安全进行生产部署。

---

_修复时间: 2025-11-22_
_修复版本: 1.0.0_
_状态: ✅ 完成_
