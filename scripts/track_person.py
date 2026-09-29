import cv2
import json
import time
from pathlib import Path
from PIL import Image
import numpy as np
from rembg import remove, new_session

VIDEO_PATH = Path('Remotion/public/why_not_you_hq.mp4')
OUTPUT_JSON = Path('Remotion/public/person_tracking.json')

cap = cv2.VideoCapture(str(VIDEO_PATH))
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

print(f"Loading video: {total_frames} frames, {width}x{height} @ {fps:.2f}fps")
session = new_session('u2net_human_seg')

# Sample every 24 frames (~1Hz) for ultra-fast processing
SAMPLE_STEP = 24
sample_indices = list(range(0, total_frames, SAMPLE_STEP))
if (total_frames - 1) not in sample_indices:
    sample_indices.append(total_frames - 1)

print(f"Analyzing {len(sample_indices)} keyframes (every {SAMPLE_STEP} frames)...")

keyframes = {}
t0 = time.time()

for idx, f_idx in enumerate(sample_indices):
    cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
    ret, frame = cap.read()
    if not ret:
        break
    
    # Downscale to 320x180 for instant segmentation
    small = cv2.resize(frame, (320, 180))
    img = Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
    
    res = remove(img, session=session)
    alpha = np.array(res)[:, :, 3]
    
    y_indices, x_indices = np.where(alpha > 40)
    if len(x_indices) > 0:
        x_min, x_max = int(np.min(x_indices)), int(np.max(x_indices))
        y_min, y_max = int(np.min(y_indices)), int(np.max(y_indices))
        
        # Normalized bounding box [x, y, w, h] (0 to 1)
        norm_box = {
            "x": round(x_min / 320.0, 4),
            "y": round(y_min / 180.0, 4),
            "w": round((x_max - x_min) / 320.0, 4),
            "h": round((y_max - y_min) / 180.0, 4),
        }
    else:
        # Fallback to center
        norm_box = {"x": 0.3, "y": 0.1, "w": 0.4, "h": 0.7}
        
    keyframes[str(f_idx)] = norm_box
    if idx % 10 == 0 or idx == len(sample_indices) - 1:
        elapsed = time.time() - t0
        print(f"[{idx+1}/{len(sample_indices)}] Frame {f_idx}: {norm_box} (elapsed: {elapsed:.1f}s)")

cap.release()

# Interpolate for every single frame from 0 to total_frames - 1
full_tracking = []
sorted_keys = sorted([int(k) for k in keyframes.keys()])

for frame_num in range(total_frames):
    # Find bounding keyframes
    k_prev = sorted_keys[0]
    k_next = sorted_keys[-1]
    
    for i in range(len(sorted_keys) - 1):
        if sorted_keys[i] <= frame_num <= sorted_keys[i+1]:
            k_prev = sorted_keys[i]
            k_next = sorted_keys[i+1]
            break
            
    if k_next == k_prev:
        t = 0.0
    else:
        t = (frame_num - k_prev) / (k_next - k_prev)
        
    b_prev = keyframes[str(k_prev)]
    b_next = keyframes[str(k_next)]
    
    interp_box = {
        "x": round(b_prev["x"] + t * (b_next["x"] - b_prev["x"]), 4),
        "y": round(b_prev["y"] + t * (b_next["y"] - b_prev["y"]), 4),
        "w": round(b_prev["w"] + t * (b_next["w"] - b_prev["w"]), 4),
        "h": round(b_prev["h"] + t * (b_next["h"] - b_prev["h"]), 4),
    }
    full_tracking.append(interp_box)

result_data = {
    "fps": fps,
    "total_frames": total_frames,
    "video_width": width,
    "video_height": height,
    "sample_step": SAMPLE_STEP,
    "tracking": full_tracking,
}

OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(result_data, f, indent=2)

print(f"Successfully saved {len(full_tracking)} frames of tracking data to {OUTPUT_JSON}!")
