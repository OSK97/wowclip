# -*- coding: utf-8 -*-
"""Test firing 30 parallel download requests to ClipsCutter for a single video.
Records creation status, concurrency limits, polling duration, download speed, and cleans up files.
"""

import concurrent.futures
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API_KEY = "8524562bb37d53208e79a95a349c89070192b82dce6fe931b26f194a1d944f1a"
BASE = "https://api.clipscutter.com/c"
FULL_SENTINEL_END = 100 * 3600
POLL_INTERVAL_S = 5
MAX_WAIT_S = 15 * 60
CONNECT_TIMEOUT_S = 30
DOWNLOAD_CHUNK = 256 * 1024

HERE = os.path.dirname(os.path.abspath(__file__))
TEMP_DIR = os.path.join(HERE, "_temp_test_30")

def log(msg, tag="INFO"):
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] [{tag:5s}] {msg}", flush=True)

def api_request(method, path, body=None):
    url = f"{BASE}{path}"
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=CONNECT_TIMEOUT_S) as r:
            raw = r.read().decode("utf-8", errors="replace")
            return r.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"statusCode": e.code, "message": str(e), "details": raw[:300]}
    except urllib.error.URLError as e:
        return None, {"statusCode": None, "message": "network error", "details": str(e.reason)}

def download_and_delete(url, worker_id):
    t0 = time.time()
    dest_path = os.path.join(TEMP_DIR, f"worker_{worker_id}.mp3")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            downloaded = 0
            with open(dest_path, "wb") as f:
                while True:
                    chunk = r.read(DOWNLOAD_CHUNK)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
        elapsed = time.time() - t0
        size_mb = downloaded / (1024 * 1024)
        if os.path.exists(dest_path):
            os.remove(dest_path)
        return True, size_mb, elapsed
    except Exception as e:
        if os.path.exists(dest_path):
            os.remove(dest_path)
        return False, 0, time.time() - t0

def run_worker(worker_id, video_id):
    t_start = time.time()
    record = {
        "worker_id": worker_id,
        "video_id": video_id,
        "clip_id": None,
        "create_status": None,
        "create_time_s": 0.0,
        "poll_time_s": 0.0,
        "download_time_s": 0.0,
        "total_time_s": 0.0,
        "final_status": None,
        "error_details": None,
        "file_size_mb": 0.0,
        "success": False
    }

    # Step 1: Create Clip
    body = {
        "video_id": video_id,
        "start_time": 0,
        "end_time": FULL_SENTINEL_END,
        "format": "mp3",
        "quality": "high",
    }
    
    t_create_start = time.time()
    status, data = api_request("POST", "/clips/youtube", body)
    t_create_end = time.time()
    record["create_time_s"] = round(t_create_end - t_create_start, 2)
    record["create_status"] = status

    if status is None or status not in (200, 202) or not data.get("success"):
        record["final_status"] = "CREATE_REJECTED"
        record["error_details"] = data.get("details") or data.get("message") or str(data)
        record["total_time_s"] = round(time.time() - t_start, 2)
        log(f"Worker {worker_id:02d}: CREATE REJECTED (HTTP {status}) - {record['error_details']}", "WARN")
        return record

    clip_id = data.get("data", {}).get("clip_id")
    record["clip_id"] = clip_id
    log(f"Worker {worker_id:02d}: Accepted -> clip_id={clip_id} in {record['create_time_s']}s", "OK")

    # Step 2: Poll Clip
    t_poll_start = time.time()
    last_status = None
    terminal_statuses = {"Failure", "Format Unavailable", "Geo Blocked", "Age Restricted"}

    while True:
        elapsed = time.time() - t_poll_start
        if elapsed > MAX_WAIT_S:
            record["final_status"] = "TIMEOUT"
            record["error_details"] = f"Gave up after {int(elapsed)}s"
            record["poll_time_s"] = round(elapsed, 2)
            record["total_time_s"] = round(time.time() - t_start, 2)
            log(f"Worker {worker_id:02d}: Poll timed out after {int(elapsed)}s", "ERROR")
            return record

        status_code, pdata = api_request("GET", f"/clips/{clip_id}")
        if status_code != 200 or not pdata.get("success"):
            details = pdata.get("details", "")
            record["final_status"] = "POLL_FAILED"
            record["error_details"] = details
            record["poll_time_s"] = round(time.time() - t_poll_start, 2)
            record["total_time_s"] = round(time.time() - t_start, 2)
            log(f"Worker {worker_id:02d}: Poll failed (HTTP {status_code}) - {details}", "ERROR")
            return record

        clip_info = pdata.get("data", {})
        curr_status = clip_info.get("status")
        if curr_status != last_status:
            last_status = curr_status
            log(f"Worker {worker_id:02d}: Status -> {curr_status} ({int(elapsed)}s)")

        if curr_status == "Completed":
            record["poll_time_s"] = round(time.time() - t_poll_start, 2)
            download_url = clip_info.get("url")
            log(f"Worker {worker_id:02d}: Completed in {record['poll_time_s']}s. Downloading...", "OK")
            
            # Step 3: Download & Clean up
            ok, size_mb, dl_time = download_and_delete(download_url, worker_id)
            record["download_time_s"] = round(dl_time, 2)
            record["file_size_mb"] = round(size_mb, 2)
            if ok:
                record["final_status"] = "SUCCESS"
                record["success"] = True
                record["total_time_s"] = round(time.time() - t_start, 2)
                log(f"Worker {worker_id:02d}: Fully verified ({size_mb:.1f} MB in {dl_time:.1f}s) -> Total {record['total_time_s']}s", "DONE")
            else:
                record["final_status"] = "DOWNLOAD_FAILED"
                record["error_details"] = "Download stream failed"
                record["total_time_s"] = round(time.time() - t_start, 2)
                log(f"Worker {worker_id:02d}: Download failed", "ERROR")
            return record

        if curr_status in terminal_statuses:
            record["final_status"] = curr_status
            record["error_details"] = f"ClipsCutter terminal status: {curr_status}"
            record["poll_time_s"] = round(time.time() - t_poll_start, 2)
            record["total_time_s"] = round(time.time() - t_start, 2)
            log(f"Worker {worker_id:02d}: Terminal error: {curr_status}", "ERROR")
            return record

        time.sleep(POLL_INTERVAL_S)

def main():
    video_url = "https://youtu.be/fbgKj0myUOk?si=YHXz36A9Q1tGLuYH"
    m = re.search(r"(?:v=|/shorts/|/embed/|/live/|youtu\.be/)([A-Za-z0-9_-]{11})", video_url)
    video_id = m.group(1) if m else "fbgKj0myUOk"
    
    num_requests = 30
    os.makedirs(TEMP_DIR, exist_ok=True)

    print("=" * 78)
    print(f"  LAUNCHING 30 PARALLEL CLIPS-CUTTER DOWNLOAD REQUESTS")
    print(f"  Target Video ID: {video_id} ({video_url})")
    print(f"  Format: MP3 High Quality (Full Audio)")
    print("=" * 78)

    t0 = time.time()
    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_requests) as executor:
        futures = {executor.submit(run_worker, i + 1, video_id): i + 1 for i in range(num_requests)}
        for fut in concurrent.futures.as_completed(futures):
            res = fut.result()
            results.append(res)

    wall_time = time.time() - t0
    results.sort(key=lambda x: x["worker_id"])

    # Clean up temp dir
    try:
        if os.path.exists(TEMP_DIR):
            for f in os.listdir(TEMP_DIR):
                os.remove(os.path.join(TEMP_DIR, f))
            os.rmdir(TEMP_DIR)
    except Exception:
        pass

    # Save raw results
    report_file = os.path.join(HERE, "out", "concurrency_test_30_report.json")
    os.makedirs(os.path.dirname(report_file), exist_ok=True)
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump({"wall_time_s": wall_time, "results": results}, f, indent=2)

    # Print summary
    successful = [r for r in results if r["success"]]
    rejected = [r for r in results if r["create_status"] not in (200, 202)]
    failed_poll = [r for r in results if r["final_status"] not in ("SUCCESS", "CREATE_REJECTED")]

    print("\n" + "=" * 78)
    print(f"  30-PARALLEL CLIPS-CUTTER TEST REPORT")
    print("=" * 78)
    print(f"  Total Wall-clock Time : {wall_time:.1f}s (~{wall_time/60:.1f} min)")
    print(f"  Successful Downloads  : {len(successful)} / {num_requests} ({len(successful)/num_requests*100:.0f}%)")
    print(f"  Creation Rejections   : {len(rejected)} / {num_requests}")
    print(f"  Polling/Other Failures: {len(failed_poll)} / {num_requests}")
    print("-" * 78)
    
    if successful:
        avg_create = sum(r["create_time_s"] for r in successful) / len(successful)
        avg_poll = sum(r["poll_time_s"] for r in successful) / len(successful)
        avg_dl = sum(r["download_time_s"] for r in successful) / len(successful)
        avg_total = sum(r["total_time_s"] for r in successful) / len(successful)
        print(f"  Average Timings (Successful Jobs):")
        print(f"    - Job Creation : {avg_create:.2f}s")
        print(f"    - Server Polling: {avg_poll:.1f}s")
        print(f"    - File Download : {avg_dl:.1f}s")
        print(f"    - Total Time    : {avg_total:.1f}s")

    print("\n  WORKER STATUS BREAKDOWN:")
    print(f"  {'ID':<4} {'Clip ID':<16} {'Create':<8} {'Poll(s)':<9} {'DL(s)':<7} {'Total(s)':<9} {'Status':<16} {'Notes'}")
    for r in results:
        cid = str(r["clip_id"] or "-")[:15]
        c_time = f"{r['create_time_s']:.1f}s"
        p_time = f"{r['poll_time_s']:.1f}s" if r['poll_time_s'] else "-"
        d_time = f"{r['download_time_s']:.1f}s" if r['download_time_s'] else "-"
        t_time = f"{r['total_time_s']:.1f}s"
        status = r["final_status"]
        notes = r["error_details"] or f"{r['file_size_mb']} MB"
        print(f"  #{r['worker_id']:<3} {cid:<16} {c_time:<8} {p_time:<9} {d_time:<7} {t_time:<9} {status:<16} {notes}")
    print("=" * 78)

if __name__ == "__main__":
    main()
