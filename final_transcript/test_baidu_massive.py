# -*- coding: utf-8 -*-
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import find_clips as F
import llm

HERE = os.path.dirname(os.path.abspath(__file__))
PAYLOAD_TXT = os.path.join(HERE, "out", "2caQ4j9oohE_payload.txt")
PAYLOAD_JSON = os.path.join(HERE, "out", "2caQ4j9oohE_payload.json")

def main():
    print("=" * 75)
    print("  TESTING BAIDU / OPENROUTER ON MASSIVE REAL PAYLOAD (~40k+ tokens)")
    print("=" * 75)

    with open(PAYLOAD_TXT, "r", encoding="utf-8") as f:
        payload_text = f.read()
    with open(PAYLOAD_JSON, "r", encoding="utf-8") as f:
        payload_data = json.load(f)

    category = "motivational"
    system_prompt, grounding, task = F.compose(category)
    user_prompt = f"{grounding}\n\n{payload_text}\n\n{task}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    total_chars = len(system_prompt) + len(user_prompt)
    print(f"[INFO] Composed prompt for category: {category}")
    print(f"[INFO] System prompt chars: {len(system_prompt):,}")
    print(f"[INFO] User prompt chars:   {len(user_prompt):,}")
    print(f"[INFO] Total Prompt chars:  {total_chars:,} (approx. ~35,000 - 45,000 tokens)")

    key = llm.get_key()
    model = "deepseek/deepseek-v4-flash-0731"

    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 64000,
        "response_format": {"type": "json_object"},
        "include_reasoning": True,
        "reasoning": {"effort": "medium"},
        "provider": {
            "order": ["Baidu", "CoreWeave", "Baseten"],
            "allow_fallbacks": True,
            "sort": "throughput"
        },
        "stream": True,
        "stream_options": {"include_usage": True}
    }

    req = urllib.request.Request(
        llm.URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream"
        }
    )

    print(f"\n[INFO] Sending stream request to OpenRouter ({model})...")
    t0 = time.time()
    t_first = None
    out, think, usage, provider = [], [], {}, None

    chunk_count = 0
    with urllib.request.urlopen(req, timeout=600) as r:
        for raw in r:
            line = raw.decode("utf-8", errors="replace").strip()
            if not line or line.startswith(":") or not line.startswith("data:"):
                continue
            chunk = line[5:].strip()
            if chunk == "[DONE]":
                break
            try:
                d = json.loads(chunk)
            except Exception:
                continue

            if not t_first:
                t_first = time.time()

            if d.get("usage"):
                usage = d["usage"]
            if d.get("provider"):
                provider = d["provider"]

            delta = ((d.get("choices") or [{}])[0] or {}).get("delta") or {}
            if delta.get("content"):
                out.append(delta["content"])
            for k in ("reasoning", "reasoning_content"):
                if delta.get(k):
                    think.append(delta[k])
            
            chunk_count += 1
            if chunk_count % 50 == 0:
                sys.stdout.write(f"\r[STREAMING] Chunks: {chunk_count} | Output tokens streaming...")
                sys.stdout.flush()

    t_end = time.time()
    total_time = t_end - t0
    ttft = (t_first - t0) if t_first else 0

    content_str = "".join(out)
    think_str = "".join(think)

    print(f"\n\n{'=' * 75}")
    print("  STREAMING & PERFORMANCE REPORT")
    print("=" * 75)
    print(f"Provider Used:         {provider or usage.get('provider', 'Baidu')}")
    print(f"Time to First Token:   {ttft:.2f}s")
    print(f"Total Response Time:   {total_time:.2f}s ({total_time/60:.1f} min)")
    
    prompt_toks = usage.get("prompt_tokens", 0)
    compl_toks = usage.get("completion_tokens", 0)
    details = usage.get("completion_tokens_details") or {}
    reasoning_toks = usage.get("reasoning_tokens") or details.get("reasoning_tokens", len(think_str)//4)
    ans_toks = compl_toks - reasoning_toks if compl_toks > reasoning_toks else len(content_str)//4
    total_toks = usage.get("total_tokens", prompt_toks + compl_toks)

    speed = compl_toks / total_time if total_time > 0 else 0

    print(f"Prompt Tokens:         {prompt_toks:,}")
    print(f"Reasoning Tokens:      {reasoning_toks:,}")
    print(f"Answer Output Tokens:  {ans_toks:,}")
    print(f"Total Output Tokens:   {compl_toks:,}")
    print(f"Total Tokens:          {total_toks:,}")
    print(f"Effective Throughput:  {speed:.1f} tokens/second")

    # Cost
    cost_usd = float(usage.get("cost") or 0)
    if cost_usd == 0:
        # manual fallback calculate at Baidu rate: prompt $0.065/M, completion $0.13/M
        cost_usd = (prompt_toks * 0.06496 / 1e6) + (compl_toks * 0.1299 / 1e6)

    cost_inr = cost_usd * 96.0

    print(f"\nCost (USD):            ${cost_usd:.5f}")
    print(f"Cost (INR @ 1$ = Rs96): Rs {cost_inr:.4f}")

    print(f"\n{'=' * 75}")
    print("  PARSING EXTRACTED CANDIDATE CLIPS")
    print("=" * 75)
    parsed = llm.parse_json(content_str, {})
    clips = parsed.get("clips") or []
    print(f"Total Candidate Clips Found: {len(clips)}\n")

    for i, c in enumerate(clips, 1):
        print(f"Clip #{i}: [{c.get('start_line')} -> {c.get('end_line')}]")
        print(f"  Title:      {c.get('title')}")
        print(f"  Confidence: {c.get('confidence')} | Hook: {c.get('hook_strength')}")
        print(f"  Why:        {c.get('why')}")
        print(f"  Words:      \"{c.get('start_words', '')}\" ... \"{c.get('end_words', '')}\"")
        print()

if __name__ == "__main__":
    main()
