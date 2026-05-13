#!/usr/bin/env python3
"""扫描 data/ 下所有 JSON 文件，生成 data/index.json（前端 manifest）。

文件命名约定：
    {YYYY-MM-DD}-{slot}.json           — 主 JSON（radar + gainers + us_stocks）
    {YYYY-MM-DD}-{slot}-onchain.json   — 链上 JSON

输出 data/index.json：
    {
      "generated_at": "...",
      "dates": ["2026-05-13", "2026-05-12", ...],
      "by_date": {
        "2026-05-13": { "slots": ["早盘"], "has_onchain": true }
      }
    }
"""
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(__file__).parent / "data"

# 文件名正则：日期-时段[-onchain].json
PAT_MAIN = re.compile(r"^(\d{4}-\d{2}-\d{2})-(早盘|午盘|晚盘|凌晨)\.json$")
PAT_ONCHAIN = re.compile(r"^(\d{4}-\d{2}-\d{2})-(早盘|午盘|晚盘|凌晨)-onchain\.json$")


def main():
    by_date_slots = defaultdict(set)          # date -> {slot}
    by_date_onchain = defaultdict(set)        # date -> {slot}

    for f in DATA_DIR.glob("*.json"):
        if f.name == "index.json":
            continue
        m = PAT_ONCHAIN.match(f.name)
        if m:
            by_date_onchain[m.group(1)].add(m.group(2))
            continue
        m = PAT_MAIN.match(f.name)
        if m:
            by_date_slots[m.group(1)].add(m.group(2))

    dates = sorted(by_date_slots.keys(), reverse=True)

    by_date = {}
    for d in dates:
        slots = sorted(by_date_slots[d])
        onchain_slots = sorted(by_date_onchain.get(d, set()))
        by_date[d] = {
            "slots": slots,
            "onchain_slots": onchain_slots,
            "has_onchain": bool(onchain_slots),
        }

    tz = timezone(timedelta(hours=8))
    payload = {
        "schema_version": "1.0",
        "generated_at": datetime.now(tz).isoformat(),
        "dates": dates,
        "by_date": by_date,
        "total_days": len(dates),
    }

    out = DATA_DIR / "index.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  => {out.relative_to(DATA_DIR.parent)} ({len(dates)} 天)")
    for d in dates[:5]:
        info = by_date[d]
        print(f"     {d}: {', '.join(info['slots'])}{' + onchain' if info['has_onchain'] else ''}")
    if len(dates) > 5:
        print(f"     ... 还有 {len(dates) - 5} 天")


if __name__ == "__main__":
    main()
