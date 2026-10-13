# 团队 AI 简报

给团队看的内部网页：每天北京时间 8:00 和 14:00 读取 [AIHOT](https://aihot.news) 精选，并用维基百科为中文读者补充人物、机构、产品和术语。个人微信群不在本项目里发送。

## 致敬 AIHOT

简报里的标题、摘要和推荐理由，来自 [AIHOT](https://aihot.news) 对全网 AI 动态的聚合。这个项目把公开接口里的精选、全部动态、热点事件、日报、周报、月报和 Codex 记录写入 Postgres，再按制造业 AI 赋能的侧重点写成团队简报。模型榜没有公开接口，没有接入。简报里的链接指向原文，不指向 AIHOT。

接入方式见 [Agent 接入 · REST API](https://aihot.news/agent?tab=api)。使用范围以 [AIHOT 使用规则](https://aihot.news/terms) 为准：这里按组织内部阅读使用，只保存标题、摘要和链接，不抓取正文。

词条事实优先来自维基百科公开摘要。维基没有对应条目时，页面会标成「待核实」，不编造履历。

## 结构

- `apps/web`：网页。只向后端要数据，不连数据库，也不保存模型密钥。
- `apps/api`：接口、8:00 / 14:00 定时更新、飞书文档。
- `packages/db`：Postgres。网页和接口都不把数据库文件放在自己进程里。

## 本地运行

先启动 Postgres，再把 `.env.example` 写成后端用的环境变量。`API_TOKEN` 在网页和接口上必须相同。

```bash
npm install
npm run build -w @ainews/shared && npm run build -w @ainews/db
DATABASE_URL=postgres://ainews:ainews@localhost:5432/ainews API_TOKEN=change-me npm run dev:api
API_URL=http://localhost:4000 API_TOKEN=change-me npm run dev:web
```

也可以直接 `docker compose up --build`。打开 [http://localhost:3000](http://localhost:3000)。

模型、飞书密钥只配在后端：

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `SITE_URL`：飞书文档里的「平台位置」要用它拼完整链接

不配置模型时，仍会拉取新闻；标题里的外文专名会对照维基百科，中文维基摘要会直接收录，英文条目标成「待生成中文」。

飞书云文档使用自建应用。权限需要开在应用身份上的「创建及编辑新版文档」。组织内获得链接的人可以编辑。文档要出现在团队文件夹里时，再加 `FEISHU_FOLDER_TOKEN`。

定时任务在后端进程里。后端需要在 8:00 和 14:00 保持运行。

以前的 `data/app.sqlite` 可以导入新库：

```bash
SQLITE_PATH=data/app.sqlite DATABASE_URL=postgres://ainews:ainews@localhost:5432/ainews npm run import:sqlite -w @ainews/api
```

## 仓库

源码仓库：[8868derek/AINEWs](https://github.com/8868derek/AINEWs)
