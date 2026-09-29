# 团队 AI 简报

给团队看的内部网页：每天北京时间 8:00 和 14:00 读取 [AIHOT](https://aihot.news) 精选，并用维基百科为中文读者补充人物、机构、产品和术语。个人微信群不在本项目里发送。

## 致敬 AIHOT

简报里的标题、摘要、推荐理由和日报导读，来自 [AIHOT](https://aihot.news) 对全网 AI 动态的聚合、打分与精选。AIHOT 把 X、公众号、RSS 和官方博客收成可读的中文条目，并在每天 08:00（北京时间）发布日报。这个项目只在这些材料上做团队阅读和中文补充词条，不把 AIHOT 的内容当作自己的原创。

接入方式见 [Agent 接入 · REST API](https://aihot.news/agent?tab=api)。使用范围以 [AIHOT 使用规则](https://aihot.news/terms) 为准：这里按组织内部阅读使用，只保存标题、摘要和链接，不抓取正文。

词条事实优先来自维基百科公开摘要。维基没有对应条目时，页面会标成「待核实」，不编造履历。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，点「立即更新」。

模型走 OpenAI 兼容接口，写在环境变量里，网页不能修改密钥：

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`

不配置模型时，仍会拉取新闻；标题里的外文专名会对照维基百科，中文维基摘要会直接收录，英文条目标成「待生成中文」。

定时任务跟进程走。`npm run dev` 或 `npm start` 需要在 8:00 和 14:00 保持运行。数据在 `data/app.sqlite`，不进入 git。

## 仓库

源码仓库：[8868derek/AINEWs](https://github.com/8868derek/AINEWs)
