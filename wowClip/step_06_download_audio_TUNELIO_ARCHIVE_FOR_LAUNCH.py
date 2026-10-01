# ARCHIVED -- not the active audio-download step for now.
#
# This is the Tunelio.dev-based downloader (paid API, exactly 10 credits per
# run, mp3 output, no proxy needed on your side). It works and was tested
# successfully, but Tunelio's plans start at ~$10/month and you're not paying
# for that yet since the app isn't launching yet -- parked here to come back
# to when you actually launch and buy the plan.
#
# Fully functional as-is (this file still runs standalone). To bring it back
# as the active step: rename this file to step_06_download_audio.py (and
# rename/move the current GProxy-based step_06_download_audio.py out of the
# way first).

import argparse
import asyncio
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import aiohttp

_HERE = os.path.dirname(os.path.abspath(__file__))
NUM_THREADS = 16
USER_AGENT = "wowClip/1.0"

# ══════════════════════════════════════════════════════════════════════════
#  CONFIG  --  read straight from tunelio.dev/docs/, nothing guessed
# ══════════════════════════════════════════════════════════════════════════

BASE_URL = "https://tunelio.dev"
CREATE_COST = 10   # /create -- the ONLY paid call this script ever makes
INFO_COST = 6      # /info -- deliberately never called, see run() below

# Docs: failed requests (4xx/5xx) do not consume credits.
ERROR_MEANINGS = {
    400: "invalid_request -- malformed URL or parameters",
    401: "unauthorized -- API key missing or invalid",
    402: "insufficient_credits -- not enough balance for this call",
    404: "not_found -- video deleted, private, or URL wrong",
    410: "gone -- the tunnel URL expired (it's only valid ~6 hours)",
    429: "rate_limited -- too many requests, check Retry-After",
    500: "server_error -- Tunelio's own server broke, not your request",
    503: "upstream_changed -- YouTube changed something on their end, "
         "Tunelio is catching up. Not a bug in this script.",
}


def get_key():
    keys_path = os.path.join(_HERE, "api_keys.json")
    try:
        with open(keys_path) as f:
            keys = json.load(f)
    except Exception:
        print("Failed to load api_keys.json")
        sys.exit(1)
    key = keys.get("TUNELIO_API_KEY")
    if not key:
        print("TUNELIO_API_KEY missing from api_keys.json")
        sys.exit(1)
    return key


def normalize_youtube_url(video_id_or_url):
    if "youtu" in video_id_or_url:
        return video_id_or_url
    return f"https://www.youtube.com/watch?v={video_id_or_url}"


def _get(path, key, params=None):
    url = f"{BASE_URL}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {key}",
        "User-Agent": "wowClip/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8", errors="replace"))
            return resp.status, body, dict(resp.headers)
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode("utf-8", errors="replace"))
        except Exception:
            body = None
        return e.code, body, dict(e.headers or {})
    except Exception as e:
        return None, {"error": "network_error", "message": str(e)}, {}


def explain_error(status, body):
    known = ERROR_MEANINGS.get(status, "unlisted error")
    msg = (body or {}).get("message", "")
    code = (body or {}).get("error", "")
    return f"HTTP {status} [{code}] {known}" + (f" -- {msg}" if msg else "")


# ══════════════════════════════════════════════════════════════════════════
#  STEPS
# ══════════════════════════════════════════════════════════════════════════

def create_download(video_url, key, quality="mp3"):
    status, body, _ = _get("/create", key, {"url": video_url, "quality": quality})
    if status != 200 or not body or body.get("status") != "ok":
        return None, explain_error(status, body)
    return body, None


def _probe_content_length(tunnel_url):
    req = urllib.request.Request(tunnel_url, headers={
        "User-Agent": USER_AGENT, "Range": "bytes=0-0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            status = resp.status
            cr = resp.headers.get("Content-Range", "")
            if status == 206 and cr and "/" in cr:
                return int(cr.split("/")[-1]), True
            cl = resp.headers.get("Content-Length")
            return (int(cl) if cl else None), False
    except urllib.error.HTTPError as e:
        if e.code == 206:
            cr = e.headers.get("Content-Range", "")
            if cr and "/" in cr:
                return int(cr.split("/")[-1]), True
        return None, False
    except Exception:
        return None, False


def _download_single_stream(tunnel_url, dest_path):
    req = urllib.request.Request(tunnel_url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            with open(dest_path, "wb") as f:
                total = 0
                while True:
                    chunk = resp.read(1024 * 256)
                    if not chunk:
                        break
                    f.write(chunk)
                    total += len(chunk)
        return total, None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code} downloading from the tunnel URL -- {e.reason}"
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def _download_parallel(tunnel_url, dest_path, content_length):
    chunk_size = content_length // NUM_THREADS
    ranges = []
    for i in range(NUM_THREADS):
        start = i * chunk_size
        end = content_length - 1 if i == NUM_THREADS - 1 else (i + 1) * chunk_size - 1
        ranges.append((start, end, i))

    raw_temp_path = dest_path + ".part"
    with open(raw_temp_path, "wb") as f:
        f.truncate(content_length)

    headers = {"User-Agent": USER_AGENT}
    raw_file = open(raw_temp_path, "r+b")

    async def download_chunk(session, start, end, idx):
        pos = start
        for attempt in range(5):
            try:
                if pos > end:
                    return
                headers_r = {**headers, "Range": f"bytes={pos}-{end}"}
                async with session.get(tunnel_url, headers=headers_r, timeout=90) as resp:
                    resp.raise_for_status()
                    async for chunk in resp.content.iter_chunked(256 * 1024):
                        if chunk:
                            raw_file.seek(pos)
                            raw_file.write(chunk)
                            pos += len(chunk)
                return
            except Exception:
                await asyncio.sleep(2)
        raise ValueError(f"chunk {idx} (bytes {start}-{end}) failed after 5 attempts")

    async def run_all():
        connector = aiohttp.TCPConnector(limit=NUM_THREADS, family=socket.AF_INET)
        async with aiohttp.ClientSession(connector=connector) as session:
            await asyncio.gather(*[
                download_chunk(session, s, e, i) for s, e, i in ranges])

    try:
        asyncio.run(run_all())
    finally:
        raw_file.close()

    os.replace(raw_temp_path, dest_path)
    return content_length


def download_tunnel(tunnel_url, dest_path):
    content_length, supports_ranges = _probe_content_length(tunnel_url)
    if content_length and supports_ranges:
        try:
            total = _download_parallel(tunnel_url, dest_path, content_length)
            return total, None, f"parallel ({NUM_THREADS} threads, range requests)"
        except Exception as e:
            print(f"  [parallel download failed: {e}] falling back to single-stream...")
    total, err = _download_single_stream(tunnel_url, dest_path)
    return total, err, "single-stream (no range support / fallback)"


# ══════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════

def run(link, out_dir):
    total_start = time.time()
    key = get_key()
    video_url = normalize_youtube_url(link)

    print(f"Requesting mp3 download link (costs exactly {CREATE_COST} credits)...")
    t1 = time.time()
    created, err = create_download(video_url, key, quality="mp3")
    create_time = round(time.time() - t1, 2)
    if err:
        print(f"[FAILED] /create error: {err}")
        print("  (per Tunelio's docs, failed requests do not consume credits -- "
              "nothing was spent)")
        return 1
    print(f"  got tunnel URL -- {created.get('file_size_str', '?')}, "
          f"expires at unix {created.get('expires')} ({create_time}s)")

    os.makedirs(out_dir, exist_ok=True)
    filename = created.get("filename") or f"{link}.mp3"
    dest_path = os.path.join(out_dir, filename)

    print("Downloading audio file...")
    t2 = time.time()
    bytes_written, err, download_method = download_tunnel(created["url"], dest_path)
    download_time = round(time.time() - t2, 2)
    if err:
        print(f"[FAILED] Download error: {err}")
        print("  (the /create call already spent 10 credits -- the tunnel URL is "
              f"valid until unix {created.get('expires')}, you can retry the "
              "download itself without spending more credits)")
        return 1

    total_time = round(time.time() - total_start, 2)
    phases = {
        "/create (link generation)": create_time,
        "file download": download_time,
    }
    bottleneck = max(phases, key=phases.get)

    print("-" * 50)
    print("RESULT       : AUDIO DOWNLOAD SUCCESSFUL")
    print(f"Video        : {link}")
    print(f"Saved to     : {dest_path}")
    print(f"File size    : {round(bytes_written / 1024 / 1024, 2)} MB")
    print(f"Credits used : {CREATE_COST}")
    print(f"Bottleneck   : {bottleneck} ({phases[bottleneck]}s of {total_time}s total)")
    print(f"  /create       : {create_time}s")
    print(f"  file download : {download_time}s  [{download_method}]")
    print(f"Total time   : {total_time}s")
    print("-" * 50)
    return 0


def main(argv=None):
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="YouTube link or video ID")
    parser.add_argument("--out", default=os.path.join(_HERE, "audio"))
    args = parser.parse_args(argv)
    return run(args.input, args.out)


if __name__ == "__main__":
    sys.exit(main())
