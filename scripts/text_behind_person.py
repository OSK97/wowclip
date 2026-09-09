"""
text_behind_person.py — Full Pipeline: Text Behind Person Effect
================================================================
1. Cut a clip from source video (start_sec → end_sec)
2. Extract every frame as PNG
3. Run rembg on each frame to get foreground alpha mask PNGs
4. Analyze first frame with DeepSeek vision to decide text placement
5. Output everything into Remotion public/ folder ready for component use

Usage:
    python scripts/text_behind_person.py
"""

import os
import sys
import subprocess
import time
import json
import base64
import urllib.request
import ssl
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

# ─── CONFIG ────────────────────────────────────────────────────────────────────
SOURCE_VIDEO = r"c:\Users\DP\Desktop\App\Remotion-Captions\public\From Klickpin.com- Wedding hair ideas that instantly upgrade your space style or celebration without much effort for beginners who want impressive.mp4"
START_SEC = 4
END_SEC = 8
FPS = 24  # Target frame rate for extraction
COMPONENT_NAME = "TextBehindPerson"

# Output paths
REMOTION_ROOT = r"c:\Users\DP\Desktop\App\Remotion"
PUBLIC_DIR = os.path.join(REMOTION_ROOT, "public", "tbp_assets")
FRAMES_DIR = os.path.join(PUBLIC_DIR, "frames")         # Original video frames
FOREGROUND_DIR = os.path.join(PUBLIC_DIR, "foreground")  # Foreground cutouts (transparent PNGs)
CLIP_PATH = os.path.join(PUBLIC_DIR, "clip.mp4")         # The trimmed clip

# DeepSeek API (for vision analysis)
DEEPSEEK_API_KEY = "sk-76083b35715d4fa6bd570b179e4f85f0"
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

# ─── STEP 1: Trim Clip ────────────────────────────────────────────────────────
def trim_clip():
    print(f"✂️  Step 1: Trimming clip from {START_SEC}s to {END_SEC}s...")
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    
    duration = END_SEC - START_SEC
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(START_SEC),
        "-i", SOURCE_VIDEO,
        "-t", str(duration),
        "-c:v", "libx264", "-crf", "18",
        "-an",  # No audio needed for this effect
        "-vf", f"fps={FPS},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
        CLIP_PATH
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"   ✅ Clip saved to {CLIP_PATH}")

# ─── STEP 2: Extract Frames ──────────────────────────────────────────────────
def extract_frames():
    print(f"🖼️  Step 2: Extracting frames at {FPS}fps...")
    os.makedirs(FRAMES_DIR, exist_ok=True)
    
    cmd = [
        "ffmpeg", "-y",
        "-i", CLIP_PATH,
        "-vf", f"fps={FPS}",
        os.path.join(FRAMES_DIR, "frame_%04d.png")
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    
    frame_count = len([f for f in os.listdir(FRAMES_DIR) if f.endswith(".png")])
    print(f"   ✅ Extracted {frame_count} frames")
    return frame_count

# ─── STEP 3: Generate Foreground Masks with rembg ────────────────────────────
def generate_foreground_masks(frame_count):
    print(f"🎭 Step 3: Generating foreground masks with rembg ({frame_count} frames)...")
    os.makedirs(FOREGROUND_DIR, exist_ok=True)
    
    from rembg import remove
    from PIL import Image
    import io
    
    for i in range(1, frame_count + 1):
        padded = str(i).zfill(4)
        input_path = os.path.join(FRAMES_DIR, f"frame_{padded}.png")
        output_path = os.path.join(FOREGROUND_DIR, f"frame_{padded}.png")
        
        if os.path.exists(output_path):
            continue
        
        with open(input_path, "rb") as f:
            input_data = f.read()
        
        output_data = remove(input_data)
        
        # Save foreground cutout with transparency
        img = Image.open(io.BytesIO(output_data))
        img.save(output_path, "PNG")
        
        if i % 10 == 0 or i == 1:
            print(f"   🔄 Processed frame {i}/{frame_count}")
    
    print(f"   ✅ All {frame_count} foreground masks generated")

# ─── STEP 4: Analyze Frame for Smart Text Placement ─────────────────────────
def analyze_frame_for_placement():
    print(f"🧠 Step 4: Analyzing first frame for smart text placement...")
    
    first_frame_path = os.path.join(FRAMES_DIR, "frame_0001.png")
    foreground_path = os.path.join(FOREGROUND_DIR, "frame_0001.png")
    
    # Encode first frame as base64 for DeepSeek vision
    with open(first_frame_path, "rb") as f:
        frame_b64 = base64.b64encode(f.read()).decode("utf-8")
    
    # Also encode the foreground mask to show the person cutout
    with open(foreground_path, "rb") as f:
        mask_b64 = base64.b64encode(f.read()).decode("utf-8")
    
    system_prompt = """You are a professional motion graphics designer analyzing a 9:16 vertical video frame (1080x1920).
Your job: decide WHERE to place large bold text BEHIND the person but IN FRONT of the background.

Rules:
- The text must be readable (not hidden behind the person's body)
- The text should overlap slightly with the person's edges for the depth effect
- Choose a vertical center position (Y coordinate) where the text will be most visible
- Consider the person's position, the background colors, and composition
- The text color must contrast with the BACKGROUND (not the person, since text goes behind them)
- Keep text within safe margins (not touching edges)

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "textY": <number 0-1920, Y center position for text>,
  "textX": <number 0-1080, X center position for text>,
  "fontSize": <number, recommended font size 60-120>,
  "textColor": "<hex color that contrasts with background>",
  "textShadow": "<CSS text-shadow for readability or empty string>",
  "backgroundDominantColor": "<hex of background dominant color>",
  "personPosition": "<top|center|bottom|left|right>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one line about why this placement works>"
}"""

    user_content = [
        {"type": "text", "text": "Here is the original video frame. Analyze where the person is and where text should go BEHIND them:"},
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{frame_b64}"}},
        {"type": "text", "text": "And here is the foreground person cutout (transparent background). Use this to understand the exact person boundary:"},
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{mask_b64}"}}
    ]
    
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": 0.1,
        "max_tokens": 500
    }
    
    req = urllib.request.Request(
        DEEPSEEK_URL,
        headers=headers,
        data=json.dumps(data).encode("utf-8")
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]
            
            # Parse JSON from response (strip markdown fences if present)
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1]
                content = content.rsplit("```", 1)[0]
            
            placement = json.loads(content.strip())
            print(f"   ✅ DeepSeek Analysis:")
            print(f"      Position: ({placement['textX']}, {placement['textY']})")
            print(f"      Font Size: {placement['fontSize']}")
            print(f"      Color: {placement['textColor']}")
            print(f"      Person: {placement['personPosition']}")
            print(f"      Reasoning: {placement['reasoning']}")
            return placement
            
    except Exception as e:
        print(f"   ⚠️  DeepSeek vision failed ({e}), using smart defaults...")
        return {
            "textY": 850,
            "textX": 540,
            "fontSize": 90,
            "textColor": "#FFFFFF",
            "textShadow": "0 4px 20px rgba(0,0,0,0.5)",
            "backgroundDominantColor": "#2d5a3d",
            "personPosition": "center",
            "confidence": 0.5,
            "reasoning": "Default center placement with white text"
        }

# ─── STEP 5: Generate Remotion Component Config ─────────────────────────────
def generate_config(frame_count, placement):
    print(f"📝 Step 5: Generating Remotion config...")
    
    config = {
        "fps": FPS,
        "durationInSeconds": END_SEC - START_SEC,
        "totalFrames": frame_count,
        "clip": "tbp_assets/clip.mp4",
        "framesDir": "tbp_assets/frames",
        "foregroundDir": "tbp_assets/foreground",
        "text": {
            "line1": "DISCIPLINE",
            "line1Style": "italic-serif",
            "line2": "CHANGES",
            "line2Style": "bold-sans",
            "line3": "everything",
            "line3Style": "italic-serif"
        },
        "placement": {
            "textY": placement["textY"],
            "textX": placement["textX"],
            "fontSize": placement["fontSize"],
            "textColor": placement["textColor"],
            "textShadow": placement.get("textShadow", ""),
            "personPosition": placement["personPosition"]
        }
    }
    
    config_path = os.path.join(
        REMOTION_ROOT, "src", "component", COMPONENT_NAME, "text-behind-person.json"
    )
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    
    print(f"   ✅ Config saved to {config_path}")
    return config

# ─── MAIN ────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("🎬 TEXT BEHIND PERSON — Full Pipeline")
    print("=" * 60)
    start = time.time()
    
    # Step 1: Trim clip
    trim_clip()
    
    # Step 2: Extract frames
    frame_count = extract_frames()
    
    # Step 3: Generate foreground masks
    generate_foreground_masks(frame_count)
    
    # Step 4: Analyze for smart placement
    placement = analyze_frame_for_placement()
    
    # Step 5: Generate config
    config = generate_config(frame_count, placement)
    
    elapsed = time.time() - start
    print(f"\n{'=' * 60}")
    print(f"✅ Pipeline complete in {elapsed:.1f}s")
    print(f"   Frames: {frame_count}")
    print(f"   Foreground masks: {FOREGROUND_DIR}")
    print(f"   Clip: {CLIP_PATH}")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    main()
