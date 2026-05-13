# Daily Market

Daily market snapshot · Crypto / 链上 / 美股，每日早盘 09:00 一份。

🌐 **在线查看**：https://bajinhash.github.io/daily-market/

## 数据源

| 板块 | 来源 | 内容 |
|------|------|------|
| 潜伏榜（radar） | BN / OKX / Bybit / HTX 期货 | OI 增量 / 资金费率 / 大户多空比 / 跨所共振 / 7d/30d 涨跌 / 生命周期 |
| 涨跌榜（gainers） | 4 交易所 spot+fut + BN Alpha | 涨跌 TOP 30 |
| 链上榜（onchain） | GMGN（sol/bsc/base）+ DEXScreener（eth） | 综合热门 / 4 链 trending / 聪明钱 / 商务跟进 / 散户预警 |
| 美股榜（us-stocks） | Yahoo Finance（FMP 兜底） | 观察池 110 只 / 成交额/涨跌幅 TOP 20 / 板块分布 |

## 架构

- 静态站，纯 HTML + CSS（内嵌） + 原生 JS
- 数据生成在另一个本地仓（输出 JSON）
- `publish.sh` 把 JSON 从源目录复制到 `data/`，运行 `update_manifest.py`，`git push` 自动触发 GitHub Pages 部署

## 本地预览

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 配置数据源

复制 `.env.example` 为 `.env`，填入本地数据源目录：

```bash
cp .env.example .env
# 编辑 .env，把 MARKET_FETCH_SRC 改成你本地数据采集脚本的输出目录
```

`.env` 已在 `.gitignore`，不会被提交到仓库。

## 发布新数据

```bash
# 1. 在源仓库生成 JSON（细节见你本地的数据采集脚本说明）

# 2. 发布到本仓
./publish.sh             # 自动找最新日期
./publish.sh 2026-05-13  # 指定日期
```

## 文件结构

```
daily-market/
├── index.html              # 前端入口（CSS 内嵌）
├── app.js                  # JSON 加载 + tab 切换 + 表格渲染
├── update_manifest.py      # 扫描 data/ 生成 index.json
├── publish.sh              # 一键发布脚本（读取 .env）
├── .env.example            # 配置模板
├── data/
│   ├── index.json          # manifest（所有可用日期）
│   ├── YYYY-MM-DD-{slot}.json
│   └── YYYY-MM-DD-{slot}-onchain.json
└── README.md
```

---

数据仅为个人研究记录，不构成投资建议。
