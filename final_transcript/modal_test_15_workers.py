# -*- coding: utf-8 -*-
"""Run 15 parallel lightweight Modal cloud containers to benchmark ClipsCutter.
Each container runs in the cloud (10 Gbps datacenter), fires the API request,
polls until completed, benchmarks the download speed, and returns timing metrics only.
"""

import sys
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import modal

app = modal.App("clipscutter-15-benchmark")

# Lightweight CPU container (No GPU needed - very cheap, fractions of a cent)
image = modal.Image.debian_slim(python_version="3.11").pip_install("requests")

API_KEY = "8524562bb37d53208e79a95a349c89070192b82dce6fe931b26f194a1d944f1a"
BASE = "https://api.clipscutter.com/c"
FULL_SENTINEL_END = 100 * 3600

@app.function(image=image, cpu=1.0, memory=512, timeout=600, max_containers=20)
def benchmark_unit(worker_id: int, video_id: str):
    import time
    import json
    import os
    import urllib.request
    import urllib.error

    t_start = time.time()
    res = {
        "worker_id": worker_id,
        "clip_id": None,
        "api_create_time_s": 0.0,
        "poll_time_s": 0.0,
        "download_time_s": 0.0,
        "download_speed_mb_s": 0.0,
        "file_size_mb": 0.0,
        "total_time_s": 0.0,
        "status": "INIT",
        "error": None
    }

    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    # 1. API Create Request
    t_create_0 = time.time()
    create_body = json.dumps({
        "video_id": video_id,
        "start_time": 0,
        "end_time": FULL_SENTINEL_END,
        "format": "mp3",
        "quality": "high"
    }).encode("utf-8")

    try:
        req = urllib.request.Request(f"{BASE}/clips/youtube", data=create_body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
        res["api_create_time_s"] = round(time.time() - t_create_0, 2)
        if not data.get("success"):
            res["status"] = "CREATE_FAILED"
            res["error"] = data.get("details") or data.get("message")
            res["total_time_s"] = round(time.time() - t_start, 2)
            return res
        clip_id = data["data"]["clip_id"]
        res["clip_id"] = clip_id
    except Exception as e:
        res["api_create_time_s"] = round(time.time() - t_create_0, 2)
        res["status"] = "CREATE_ERROR"
        res["error"] = str(e)
        res["total_time_s"] = round(time.time() - t_start, 2)
        return res

    # 2. Polling ClipsCutter Server
    t_poll_0 = time.time()
    dl_url = None
    while time.time() - t_poll_0 < 300:
        try:
            req = urllib.request.Request(f"{BASE}/clips/{clip_id}", headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=20) as resp:
                pdata = json.loads(resp.read().decode("utf-8", errors="replace"))
            if pdata.get("success"):
                cinfo = pdata.get("data", {})
                st = cinfo.get("status")
                if st == "Completed":
                    dl_url = cinfo.get("url")
                    res["poll_time_s"] = round(time.time() - t_poll_0, 2)
                    break
                elif st in ("Failure", "Format Unavailable", "Geo Blocked", "Age Restricted"):
                    res["status"] = st
                    res["poll_time_s"] = round(time.time() - t_poll_0, 2)
                    res["total_time_s"] = round(time.time() - t_start, 2)
                    return res
        except Exception:
            pass
        time.sleep(5)

    if not dl_url:
        res["status"] = "POLL_TIMEOUT"
        res["poll_time_s"] = round(time.time() - t_poll_0, 2)
        res["total_time_s"] = round(time.time() - t_start, 2)
        return res

    # 3. Cloud Datacenter Download Benchmark
    t_dl_0 = time.time()
    tmp_path = f"/tmp/audio_test_{worker_id}.mp3"
    try:
        req = urllib.request.Request(dl_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            downloaded = 0
            with open(tmp_path, "wb") as f:
                while True:
                    chunk = resp.read(256 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
        dl_time = max(0.01, time.time() - t_dl_0)
        size_mb = downloaded / (1024 * 1024)
        speed = size_mb / dl_time
        res["download_time_s"] = round(dl_time, 2)
        res["file_size_mb"] = round(size_mb, 2)
        res["download_speed_mb_s"] = round(speed, 2)
        res["status"] = "SUCCESS"
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    except Exception as e:
        res["status"] = "DOWNLOAD_ERROR"
        res["error"] = str(e)
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    res["total_time_s"] = round(time.time() - t_start, 2)
    return res

@app.local_entrypoint()
def main():
    import json
    import time

    video_id = "fbgKj0myUOk"
    num_workers = 15
    worker_ids = list(range(1, num_workers + 1))
    video_ids = [video_id] * num_workers

    print("\n" + "=" * 82)
    print(f"  LAUNCHING {num_workers} CHEAP PARALLEL MODAL CLOUD WORKERS")
    print(f"  Target Video ID: {video_id}")
    print("=" * 82 + "\n")

    t0 = time.time()
    results = list(benchmark_unit.map(worker_ids, video_ids))
    wall_time = time.time() - t0

    results.sort(key=lambda x: x["worker_id"])

    print("\n" + "=" * 82)
    print(f"  15 CLOUD WORKER BENCHMARK RESULTS (TIMINGS ONLY)")
    print("=" * 82)
    print(f"  {'Unit':<6} {'API Create':<12} {'Server Poll':<13} {'Cloud DL':<11} {'DL Speed':<14} {'Total Time':<12} {'Status'}")
    print("-" * 82)

    for r in results:
        w_id = f"#{r['worker_id']:02d}"
        c_time = f"{r['api_create_time_s']:.2f}s"
        p_time = f"{r['poll_time_s']:.1f}s" if r['poll_time_s'] else "-"
        d_time = f"{r['download_time_s']:.2f}s" if r['download_time_s'] else "-"
        speed = f"{r['download_speed_mb_s']:.1f} MB/s" if r['download_speed_mb_s'] else "-"
        t_time = f"{r['total_time_s']:.1f}s"
        st = r['status']
        print(f"  {w_id:<6} {c_time:<12} {p_time:<13} {d_time:<11} {speed:<14} {t_time:<12} {st}")

    successful = [r for r in results if r["status"] == "SUCCESS"]
    print("=" * 82)
    print(f"  Summary:")
    print(f"    - Total Wall-Clock Time : {wall_time:.1f}s (~{wall_time/60:.1f} min)")
    print(f"    - Success Rate          : {len(successful)} / {num_workers} ({len(successful)/num_workers*100:.0f}%)")
    if successful:
        avg_create = sum(r['api_create_time_s'] for r in successful) / len(successful)
        avg_poll = sum(r['poll_time_s'] for r in successful) / len(successful)
        avg_dl = sum(r['download_time_s'] for r in successful) / len(successful)
        avg_speed = sum(r['download_speed_mb_s'] for r in successful) / len(successful)
        avg_total = sum(r['total_time_s'] for r in successful) / len(successful)
        print(f"    - Avg API Create Time   : {avg_create:.2f}s")
        print(f"    - Avg ClipsCutter Poll  : {avg_poll:.1f}s")
        print(f"    - Avg Cloud DL Time     : {avg_dl:.2f}s (Speed: ~{avg_speed:.1f} MB/s)")
        print(f"    - Avg Total Time / Unit : {avg_total:.1f}s")
    print("=" * 82 + "\n")
