# 生产部署前必读：迁移历史修复指南

**问题**: Wrangler D1迁移历史不完整，缺少uploads表的创建迁移。

**影响**: 无法部署到Cloudflare Pages（D1数据库初始化失败）。

**必须执行**: 部署前修复迁移历史（30分钟）。

---

## 🔧 修复方案（选择一种）

### 方案A：创建基线迁移（推荐）⭐⭐⭐

**适用**: Cloudflare Pages + D1

**步骤**:

#### 1. 导出当前完整Schema

```bash
cd /Users/sunsiqi/Documents/edge-next-starter

# 导出完整表结构
sqlite3 prisma/dev.db <<EOF > migrations/0001_baseline.sql
.output stdout
.schema --indent
EOF
```

#### 2. 清理导出的SQL（移除不需要的内容）

编辑 `migrations/0001_baseline.sql`，保留：

- ✅ 所有 `CREATE TABLE` 语句
- ✅ 所有 `CREATE INDEX` 语句
- ✅ 所有 `CREATE UNIQUE INDEX` 语句

移除：

- ❌ SQLite系统表（sqlite_sequence等）
- ❌ 触发器（Prisma自动管理）

#### 3. 重新组织迁移文件

```bash
# 备份旧迁移
mkdir migrations_old
mv migrations/0001_init.sql migrations_old/
mv migrations/0002_auth_tables.sql migrations_old/
mv migrations/0003_add_multi_model_fields.sql migrations_old/

# 重命名基线迁移
mv migrations/0001_baseline.sql migrations/0001_complete_baseline.sql

# 编辑基线迁移，添加头部注释
cat > migrations/0001_complete_baseline.sql <<'HEADER'
-- Migration number: 0001
-- Complete baseline migration including all tables
-- Generated from existing schema: 2025-11-21

HEADER

# 追加表结构（手动编辑或使用导出的内容）
```

#### 4. 修改0003迁移为幂等操作

编辑 `migrations/0003_add_multi_model_fields.sql`:

```sql
-- Migration number: 0003 	 2025-11-21T03:13:22.906Z

-- 使用幂等操作（如果列已存在则忽略）
-- SQLite不支持IF NOT EXISTS，所以需要先检查

-- 方法1：先删除再添加（如果已存在）
-- 注意：生产环境慎用，可能丢失数据

-- 方法2：使用事务 + 错误处理
BEGIN;

-- 尝试添加列，如果失败则忽略
-- 注意：需要Cloudflare D1支持的语法

ALTER TABLE uploads ADD COLUMN model_consensus REAL;
ALTER TABLE uploads ADD COLUMN model_count INTEGER;
ALTER TABLE uploads ADD COLUMN educational_observations TEXT;
ALTER TABLE uploads ADD COLUMN teaching_suggestions TEXT;
ALTER TABLE uploads ADD COLUMN age_appropriateness TEXT;
ALTER TABLE uploads ADD COLUMN creative_elements TEXT;

COMMIT;
```

**更好的方案**：将0003合并到0001基线中（推荐）

```bash
# 直接在0001_complete_baseline.sql的uploads表定义中包含新字段
# 这样0003就不需要了
```

#### 5. 测试迁移

```bash
# 1. 清理Wrangler状态
rm -rf .wrangler/state/v3/d1

# 2. 测试本地迁移
pnpm wrangler d1 migrations apply cloudflare-worker-template-local --local

# 3. 验证表结构
pnpm wrangler d1 execute cloudflare-worker-template-local --local \
  --command "SELECT name FROM sqlite_master WHERE type='table';"

# 4. 验证uploads表字段
pnpm wrangler d1 execute cloudflare-worker-template-local --local \
  --command "PRAGMA table_info(uploads);"
```

#### 6. 生产部署

```bash
# 1. 部署迁移到生产D1
pnpm wrangler d1 migrations apply <production-db-name> --remote

# 2. 部署应用
pnpm pages:deploy:prod
```

---

### 方案B：直接在D1执行完整Schema（临时方案）

**适用**: 紧急部署，后续补迁移历史

**步骤**:

#### 1. 导出完整CREATE语句

```bash
sqlite3 prisma/dev.db .schema > complete_schema.sql
```

#### 2. 在Cloudflare Dashboard手动执行

1. 访问 https://dash.cloudflare.com
2. 选择 Workers & Pages → D1
3. 打开生产数据库
4. 点击 Console 标签
5. 粘贴 complete_schema.sql 内容
6. 执行

#### 3. 标记所有迁移为已应用

```bash
# 这一步需要Cloudflare支持，或者手动在_cf_KV中写入标记
# 暂时跳过迁移检查
```

**缺点**:

- ❌ 无法追踪迁移历史
- ❌ 后续迁移可能失败
- ❌ 不适合长期使用

---

### 方案C：放弃Wrangler迁移，使用Prisma（不推荐）

**仅适用**: VPS部署，不用Cloudflare D1

**步骤**:

```bash
# 完全切换到Prisma迁移系统
pnpm prisma migrate dev --name baseline
pnpm prisma migrate deploy
```

**缺点**:

- ❌ 无法部署到Cloudflare Pages
- ❌ 失去D1的优势

---

## 📋 部署检查清单

### Cloudflare Pages部署前

- [ ] 完成方案A：创建基线迁移
- [ ] 本地测试迁移成功
- [ ] 验证uploads表包含所有字段
- [ ] 配置生产环境变量
- [ ] 测试Worker在新D1数据库上运行

### VPS部署前

- [ ] 创建Prisma基线迁移
- [ ] 配置生产数据库连接
- [ ] 测试 `prisma migrate deploy`
- [ ] 配置环境变量
- [ ] 测试Worker运行

---

## ⚠️ 重要提示

1. **不要直接在生产环境使用0003迁移**
   - 它会报错：no such table: uploads

2. **优先使用方案A（基线迁移）**
   - 最规范、最安全
   - 迁移历史清晰

3. **测试环境先验证**
   - 本地测试成功后再部署生产
   - 使用 `--local` 标志测试

4. **备份生产数据**
   - 执行迁移前导出D1数据
   - Cloudflare Dashboard → D1 → Export

---

## 🆘 如果部署失败

### 错误：no such table: uploads

**解决**: 使用方案A重新创建基线迁移

### 错误：column already exists

**解决**: 0003迁移改为幂等操作

### 错误：migration already applied

**解决**: 检查 `_cf_KV` 表，清理错误的迁移标记

---

**创建日期**: 2025-11-21
**适用版本**: edge-next-starter v1.1.0
**联系人**: Coding Team
