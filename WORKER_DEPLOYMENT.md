# OCR Worker 部署指南

本文档说明如何在不同环境下部署和运行OCR Worker。

## 📦 环境说明

### 开发环境（本地）

开发时，Worker会随Next.js开发服务器一起启动，支持热重载。

### 生产环境

提供三种部署方式：

1. **GitHub Actions** - 定时自动运行（推荐，免费）
2. **VPS/云服务器** - 持续运行或定时任务
3. **手动运行** - 按需处理

---

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

确保安装了以下依赖：

- `tsx` - TypeScript执行器
- `concurrently` - 并行运行多个进程（开发环境）

### 2. 配置环境变量

在`.env.local`中设置：

```env
# ModelScope API
MODELSCOPE_API_KEY=your_api_key_here

# Database
DATABASE_URL=your_database_url_here

# Storage (如使用R2)
R2_BUCKET_NAME=your_bucket_name
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
```

### 3. 运行数据库迁移

```bash
# 生成Prisma客户端
pnpm prisma generate

# 创建Reports表迁移
pnpm wrangler d1 migrations create cloudflare-worker-template-local add_reports_table

# 编辑生成的SQL文件，添加：
# CREATE TABLE reports (
#   id INTEGER PRIMARY KEY AUTOINCREMENT,
#   lesson_id INTEGER NOT NULL,
#   report_type TEXT NOT NULL DEFAULT 'class',
#   content TEXT NOT NULL,
#   generated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
#   FOREIGN KEY (lesson_id) REFERENCES lesson_cards (id)
# );
# CREATE INDEX idx_reports_lesson_id ON reports(lesson_id);

# 应用迁移
pnpm db:migrate:local
```

---

## 💻 开发环境

### 方式1：一起启动（推荐）

```bash
# 同时启动Next.js开发服务器和Worker
pnpm dev
```

这会启动：

- **Next.js** (端口3000) - 前端开发服务器
- **Worker** - OCR后台进程，支持热重载

**特性：**

- ✅ 修改代码自动重启Worker
- ✅ 彩色日志输出
- ✅ 更短的轮询间隔（3秒）
- ✅ 友好的开发体验

### 方式2：单独启动

```bash
# 只启动Next.js
pnpm dev:next

# 单独启动Worker（支持热重载）
pnpm worker:dev
```

### 单次运行（测试用）

```bash
# 处理所有pending上传后退出
pnpm worker:once
```

---

## 🌐 生产环境部署

### 选项1：GitHub Actions（推荐）

**优点：**

- ✅ 完全免费（每月2000分钟）
- ✅ 无需管理服务器
- ✅ 自动定时运行
- ✅ 配置简单

**步骤：**

1. **配置GitHub Secrets**

   在仓库的 `Settings` → `Secrets and variables` → `Actions` 中添加：
   - `MODELSCOPE_API_KEY` - 魔搭API密钥
   - `DATABASE_URL` - 数据库连接字符串
   - 其他必要的环境变量

2. **推送代码**

   ```bash
   git add .
   git commit -m "Add OCR worker"
   git push
   ```

3. **查看运行状态**

   访问仓库的 `Actions` 标签页查看运行日志。

4. **调整运行频率**（可选）

   编辑 `.github/workflows/ocr-worker.yml`：

   ```yaml
   on:
     schedule:
       - cron: '*/5 * * * *' # 每5分钟（默认）
       # - cron: '*/10 * * * *'  # 每10分钟
       # - cron: '0 * * * *'     # 每小时
   ```

**限制：**

- 单次运行最长6小时
- 并发任务有限制
- 不适合需要实时处理的场景

---

### 选项2：VPS/云服务器

适合需要持续运行或实时处理的场景。

#### 方法A：使用PM2（推荐）

1. **安装PM2**

   ```bash
   pnpm add -g pm2
   ```

2. **创建PM2配置文件**

   创建 `ecosystem.config.js`：

   ```javascript
   module.exports = {
     apps: [
       {
         name: 'ocr-worker',
         script: 'pnpm',
         args: 'worker:prod',
         cwd: '/path/to/your/project',
         instances: 1,
         autorestart: true,
         watch: false,
         max_memory_restart: '500M',
         env: {
           NODE_ENV: 'production',
           DATABASE_URL: 'your_database_url',
           MODELSCOPE_API_KEY: 'your_api_key',
         },
       },
     ],
   };
   ```

3. **启动Worker**

   ```bash
   # 启动
   pm2 start ecosystem.config.js

   # 查看状态
   pm2 status

   # 查看日志
   pm2 logs ocr-worker

   # 停止
   pm2 stop ocr-worker

   # 重启
   pm2 restart ocr-worker
   ```

4. **开机自启动**

   ```bash
   pm2 startup
   pm2 save
   ```

#### 方法B：使用systemd

1. **创建systemd服务文件**

   创建 `/etc/systemd/system/ocr-worker.service`：

   ```ini
   [Unit]
   Description=OCR Worker for Student Works
   After=network.target

   [Service]
   Type=simple
   User=your_username
   WorkingDirectory=/path/to/your/project
   Environment="NODE_ENV=production"
   Environment="DATABASE_URL=your_database_url"
   Environment="MODELSCOPE_API_KEY=your_api_key"
   ExecStart=/usr/bin/pnpm worker:prod
   Restart=on-failure
   RestartSec=10
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```

2. **启动服务**

   ```bash
   # 重载systemd配置
   sudo systemctl daemon-reload

   # 启动服务
   sudo systemctl start ocr-worker

   # 查看状态
   sudo systemctl status ocr-worker

   # 开机自启
   sudo systemctl enable ocr-worker

   # 查看日志
   sudo journalctl -u ocr-worker -f
   ```

#### 方法C：使用cron定时任务

适合低频率处理场景（每小时或每天运行一次）。

1. **编辑crontab**

   ```bash
   crontab -e
   ```

2. **添加定时任务**

   ```cron
   # 每10分钟运行一次
   */10 * * * * cd /path/to/project && /usr/bin/pnpm worker:once >> /var/log/ocr-worker.log 2>&1

   # 每小时运行一次
   0 * * * * cd /path/to/project && /usr/bin/pnpm worker:once >> /var/log/ocr-worker.log 2>&1
   ```

---

### 选项3：Docker部署

1. **创建Dockerfile**

   ```dockerfile
   FROM node:20-alpine

   # Install pnpm
   RUN npm install -g pnpm

   WORKDIR /app

   # Copy package files
   COPY package.json pnpm-lock.yaml ./

   # Install dependencies
   RUN pnpm install --frozen-lockfile --prod

   # Copy application code
   COPY . .

   # Generate Prisma Client
   RUN pnpm prisma generate

   # Run worker
   CMD ["pnpm", "worker:prod"]
   ```

2. **构建和运行**

   ```bash
   # 构建镜像
   docker build -t ocr-worker .

   # 运行容器
   docker run -d \
     --name ocr-worker \
     --restart unless-stopped \
     -e DATABASE_URL="your_database_url" \
     -e MODELSCOPE_API_KEY="your_api_key" \
     ocr-worker

   # 查看日志
   docker logs -f ocr-worker
   ```

---

## 📊 监控和日志

### 查看Worker状态

开发环境：

- Worker日志会在终端实时显示
- 带颜色标记，易于区分

生产环境：

- PM2: `pm2 logs ocr-worker`
- systemd: `sudo journalctl -u ocr-worker -f`
- Docker: `docker logs -f ocr-worker`

### 性能指标

Worker会输出：

- 处理速度（每分钟处理的照片数）
- 成功/失败数量
- 当前pending数量

### 数据库查询

查看处理状态：

```sql
-- 查看各状态数量
SELECT triage_status, COUNT(*) as count
FROM uploads
GROUP BY triage_status;

-- 查看待处理数量
SELECT COUNT(*) FROM uploads WHERE triage_status = 'pending';

-- 查看失败原因
SELECT id, last_error, retry_count
FROM uploads
WHERE triage_status = 'failed';
```

---

## 🔧 故障排查

### Worker不处理照片

1. **检查Worker是否运行**

   ```bash
   # PM2
   pm2 status

   # systemd
   sudo systemctl status ocr-worker

   # Docker
   docker ps | grep ocr-worker
   ```

2. **检查数据库连接**

   ```bash
   pnpm worker:once
   # 如果报错"ECONNREFUSED"，检查DATABASE_URL
   ```

3. **检查API密钥**
   ```bash
   # 测试ModelScope连接
   curl -H "Authorization: Bearer $MODELSCOPE_API_KEY" \
     https://api-inference.modelscope.cn/v1/models
   ```

### OCR识别率低

- 确保照片清晰，姓名可见
- 检查学生姓名是否在班级名单中
- 调整置信度阈值（在`triage-service.ts`中修改）

### 处理速度慢

- 检查网络连接
- ModelScope API可能有限流
- 考虑增加并发数（需谨慎，避免过载）

---

## 📝 最佳实践

### 开发阶段

1. 使用 `pnpm dev` 同时启动Next.js和Worker
2. 准备一些测试照片进行验证
3. 观察日志输出，确认OCR准确率

### 生产环境

1. **小规模试运行**
   - 先用少量真实数据测试
   - 验证OCR准确率和三态分流逻辑

2. **选择合适的部署方式**
   - 低频使用（<100张/天）→ GitHub Actions
   - 中等规模（100-500张/天）→ VPS + PM2
   - 大规模（>500张/天）→ 考虑分布式方案

3. **监控和告警**
   - 定期检查失败率
   - 设置日志轮转，避免磁盘占满
   - 考虑接入监控服务（如Sentry、DataDog）

4. **备份策略**
   - 定期备份数据库
   - 保留原始照片（R2/S3）

---

## 🔄 更新和维护

### 代码更新

开发环境：

```bash
git pull
pnpm install
pnpm dev  # Worker会自动重启
```

生产环境（PM2）：

```bash
git pull
pnpm install
pnpm prisma generate
pm2 restart ocr-worker
```

生产环境（systemd）：

```bash
git pull
pnpm install
pnpm prisma generate
sudo systemctl restart ocr-worker
```

### 数据库迁移

```bash
# 本地测试
pnpm db:migrate:local

# 生产环境
pnpm db:migrate:prod
```

---

## 📞 获取帮助

- 查看Worker日志了解错误信息
- 检查GitHub Issues查找类似问题
- 确保所有环境变量正确配置
- 验证ModelScope API配额

---

## 附录：命令速查表

| 命令                               | 说明                     | 环境 |
| ---------------------------------- | ------------------------ | ---- |
| `pnpm dev`                         | 启动Next.js + Worker     | 开发 |
| `pnpm worker:dev`                  | 单独启动Worker（热重载） | 开发 |
| `pnpm worker:once`                 | 单次处理所有pending      | 任意 |
| `pnpm worker:prod`                 | 生产模式运行             | 生产 |
| `pm2 start ecosystem.config.js`    | PM2启动                  | 生产 |
| `pm2 logs ocr-worker`              | 查看PM2日志              | 生产 |
| `sudo systemctl status ocr-worker` | 查看systemd状态          | 生产 |
| `docker logs -f ocr-worker`        | 查看Docker日志           | 生产 |
