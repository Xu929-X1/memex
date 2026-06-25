import json
import time

import requests

OLLAMA_URL = "http://localhost:11434/api/chat"

# model u want to test, my purpose is to test performance for different context window, so format is {"model": modelName, "num_ctx": context length}
CONFIGS = [
    {"model": "qwen3:8b", "num_ctx": 16384},
    {"model": "qwen3:14b", "num_ctx": 8192},
]

# Custom Task
TASKS = []


def run_one(model: str, num_ctx: int, task: dict) -> dict:
    messages = []
    if task.get("system"):
        messages.append({"role": "system", "content": task["system"]})
    messages.append({"role": "user", "content": task["prompt"]})

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"num_ctx": num_ctx, "temperature": 0},
    }

    t0 = time.time()
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=300)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}
    elapsed = time.time() - t0

    content = data.get("message", {}).get("content", "")

    # tok/s: Ollama 返回 eval_count (生成的 token 数) 和 eval_duration (纳秒)
    eval_count = data.get("eval_count", 0)
    eval_dur_ns = data.get("eval_duration", 1)
    tok_per_s = eval_count / (eval_dur_ns / 1e9) if eval_dur_ns else 0
    # 首 token 延迟: prompt 处理时间
    prompt_dur_ns = data.get("prompt_eval_duration", 0)
    ttft = prompt_dur_ns / 1e9

    # JSON 合法性
    json_ok = None
    if task.get("expect_json"):
        json_ok = try_parse_json(content)

    # 关键词命中
    kw_hit = None
    if task.get("keywords"):
        kw_hit = all(k.lower() in content.lower() for k in task["keywords"])

    return {
        "ok": True,
        "content": content,
        "tok_per_s": tok_per_s,
        "ttft": ttft,
        "elapsed": elapsed,
        "json_ok": json_ok,
        "kw_hit": kw_hit,
    }


def try_parse_json(text: str) -> bool:
    """尝试解析 JSON。容忍模型偶尔包 markdown 代码块。"""
    s = text.strip()
    if s.startswith("```"):
        s = s.split("```", 2)
        s = s[1] if len(s) > 1 else text
        if s.startswith("json"):
            s = s[4:]
        s = s.strip()
    try:
        json.loads(s)
        return True
    except Exception:
        return False


def main():
    results = {}  # (model,ctx) -> list of task results

    for cfg in CONFIGS:
        key = f"{cfg['model']} @ {cfg['num_ctx']}"
        results[key] = []
        print(f"\n{'=' * 60}\n跑配置: {key}\n{'=' * 60}")

        for task in TASKS:
            print(f"  → {task['name']} ...", end=" ", flush=True)
            res = run_one(cfg["model"], cfg["num_ctx"], task)
            results[key].append((task, res))
            if not res["ok"]:
                print(f"失败: {res['error']}")
                continue
            flags = []
            if res["json_ok"] is not None:
                flags.append(f"JSON {'✓' if res['json_ok'] else '✗'}")
            if res["kw_hit"] is not None:
                flags.append(f"命中 {'✓' if res['kw_hit'] else '✗'}")
            print(f"{res['tok_per_s']:.0f} tok/s  {' '.join(flags)}")

    # ── 汇总表 ──
    print(f"\n\n{'=' * 60}\n汇总\n{'=' * 60}")
    for key, task_results in results.items():
        oks = [r for _, r in task_results if r["ok"]]
        if not oks:
            print(f"\n{key}: 全部失败")
            continue

        json_tasks = [
            r for _, r in task_results if r["ok"] and r["json_ok"] is not None
        ]
        json_rate = (
            (sum(r["json_ok"] for r in json_tasks) / len(json_tasks) * 100)
            if json_tasks
            else None
        )

        kw_tasks = [r for _, r in task_results if r["ok"] and r["kw_hit"] is not None]
        kw_rate = (
            (sum(r["kw_hit"] for r in kw_tasks) / len(kw_tasks) * 100)
            if kw_tasks
            else None
        )

        avg_tps = sum(r["tok_per_s"] for r in oks) / len(oks)
        avg_ttft = sum(r["ttft"] for r in oks) / len(oks)

        print(f"\n{key}")
        print(f"  平均速度    : {avg_tps:.0f} tok/s")
        print(f"  首token延迟 : {avg_ttft * 1000:.0f} ms")
        if json_rate is not None:
            print(f"  JSON合法率  : {json_rate:.0f}%  ({len(json_tasks)} 个任务)")
        if kw_rate is not None:
            print(f"  关键词命中  : {kw_rate:.0f}%  ({len(kw_tasks)} 个任务)")

    print(f"\n\n{'=' * 60}\n逐任务输出 (人工核查)\n{'=' * 60}")
    for i, task in enumerate(TASKS):
        print(f"\n[{task['name']}]")
        for key, task_results in results.items():
            res = task_results[i][1]
            out = (
                res.get("content", res.get("error", ""))[:300]
                if res["ok"]
                else res["error"]
            )
            print(f"  {key}:\n    {out}\n")


if __name__ == "__main__":
    main()
