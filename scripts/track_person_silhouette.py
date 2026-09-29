import cv2
import json
import time
from pathlib import Path
from PIL import Image
import numpy as np
from rembg import remove, new_session

VIDEO_PATH = Path('Remotion/public/why_not_you_hq.mp4')
OUTPUT_JSON_PUBLIC = Path('Remotion/public/person_tracking.json')
OUTPUT_JSON_SRC = Path('Remotion/src/person_tracking.json')

cap = cv2.VideoCapture(str(VIDEO_PATH))
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

print(f"Loading video: {total_frames} frames, {width}x{height} @ {fps:.2f}fps")
session = new_session('u2net_human_seg')

# Sample every 18 frames (~0.6s) for smooth tracking
SAMPLE_STEP = 18
sample_indices = list(range(0, total_frames, SAMPLE_STEP))
if (total_frames - 1) not in sample_indices:
    sample_indices.append(total_frames - 1)

print(f"Analyzing {len(sample_indices)} keyframes with exact silhouette extraction...")

NUM_CONTOUR_POINTS = 40
keyframes = {}
t0 = time.time()

for idx, f_idx in enumerate(sample_indices):
    cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
    ret, frame = cap.read()
    if not ret:
        break
    
    # 320x180 is high enough resolution for tight contours and very fast
    W_SEG, H_SEG = 320, 180
    small = cv2.resize(frame, (W_SEG, H_SEG))
    img = Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
    
    res = remove(img, session=session)
    alpha = np.array(res)[:, :, 3]
    
    binary = (alpha > 70).astype(np.uint8) * 255
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    
    if len(contours) > 0:
        cnt = max(contours, key=cv2.contourArea)
        # Ensure consistent orientation
        if cv2.contourArea(cnt, oriented=True) < 0:
            cnt = cnt[::-1]
            
        pts = cnt[:, 0, :]
        indices = np.linspace(0, len(pts) - 1, NUM_CONTOUR_POINTS, dtype=int)
        sampled = pts[indices]
        
        # Align starting point to top of head (lowest y)
        top_idx = np.argmin(sampled[:, 1])
        sampled = np.roll(sampled, -top_idx, axis=0)
        
        norm_contour = [[round(float(p[0]) / W_SEG, 4), round(float(p[1]) / H_SEG, 4)] for p in sampled]
        
        y_indices, x_indices = np.where(binary > 0)
        x_min, x_max = int(np.min(x_indices)), int(np.max(x_indices))
        y_min, y_max = int(np.min(y_indices)), int(np.max(y_indices))
        total_h = y_max - y_min
        
        # Head vs Chest breakdown
        # Head is roughly top 36% of visible person
        head_cutoff_y = int(y_min + total_h * 0.36)
        head_y, head_x = np.where((binary > 0) & (np.arange(H_SEG)[:, None] < head_cutoff_y))
        chest_y, chest_x = np.where((binary > 0) & (np.arange(H_SEG)[:, None] >= head_cutoff_y))
        
        if len(head_x) > 0:
            head_box = {
                "x": round(float(np.min(head_x)) / W_SEG, 4),
                "y": round(float(y_min) / H_SEG, 4),
                "w": round(float(np.max(head_x) - np.min(head_x)) / W_SEG, 4),
                "h": round(float(head_cutoff_y - y_min) / H_SEG, 4)
            }
        else:
            head_box = {"x": 0.42, "y": 0.12, "w": 0.14, "h": 0.25}
            
        if len(chest_x) > 0:
            chest_box = {
                "x": round(float(np.min(chest_x)) / W_SEG, 4),
                "y": round(float(head_cutoff_y) / H_SEG, 4),
                "w": round(float(np.max(chest_x) - np.min(chest_x)) / W_SEG, 4),
                "h": round(float(y_max - head_cutoff_y) / H_SEG, 4)
            }
        else:
            chest_box = {"x": 0.29, "y": 0.37, "w": 0.35, "h": 0.42}
            
        overall_box = {
            "x": round(x_min / W_SEG, 4),
            "y": round(y_min / H_SEG, 4),
            "w": round((x_max - x_min) / W_SEG, 4),
            "h": round((y_max - y_min) / H_SEG, 4)
        }
    else:
        # Fallbacks
        norm_contour = [[0.48, 0.12], [0.35, 0.6], [0.41, 0.78], [0.64, 0.56]]
        head_box = {"x": 0.42, "y": 0.12, "w": 0.14, "h": 0.25}
        chest_box = {"x": 0.29, "y": 0.37, "w": 0.35, "h": 0.42}
        overall_box = {"x": 0.3, "y": 0.1, "w": 0.4, "h": 0.7}
        
    keyframes[str(f_idx)] = {
        "box": overall_box,
        "head": head_box,
        "chest": chest_box,
        "contour": norm_contour
    }
    
    if idx % 15 == 0 or idx == len(sample_indices) - 1:
        elapsed = time.time() - t0
        print(f"[{idx+1}/{len(sample_indices)}] Frame {f_idx}: processed in {elapsed:.1f}s")

cap.release()

print("Interpolating for all frames...")
sorted_keys = sorted([int(k) for k in keyframes.keys()])
full_tracking = []

def interp_box(b0, b1, t):
    return {
        "x": round(b0["x"] + t * (b1["x"] - b0["x"]), 4),
        "y": round(b0["y"] + t * (b1["y"] - b0["y"]), 4),
        "w": round(b0["w"] + t * (b1["w"] - b0["w"]), 4),
        "h": round(b0["h"] + t * (b1["h"] - b0["h"]), 4),
    }

def interp_contour(c0, c1, t):
    res = []
    for p0, p1 in zip(c0, c1):
        x = round(p0[0] + t * (p1[0] - p0[0]), 4)
        y = round(p0[1] + t * (p1[1] - p0[1]), 4)
        res.append([x, y])
    return res

for frame_num in range(total_frames):
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
        
    d_prev = keyframes[str(k_prev)]
    d_next = keyframes[str(k_next)]
    
    frame_entry = {
        "box": interp_box(d_prev["box"], d_next["box"], t),
        "head": interp_box(d_prev["head"], d_next["head"], t),
        "chest": interp_box(d_prev["chest"], d_next["chest"], t),
        "contour": interp_contour(d_prev["contour"], d_next["contour"], t)
    }
    full_tracking.append(frame_entry)

result_data = {
    "fps": fps,
    "totalFrames": total_frames,
    "tracking": full_tracking
}

json_str = json.dumps(result_data)
OUTPUT_JSON_PUBLIC.write_text(json_str)
OUTPUT_JSON_SRC.write_text(json_str)
print(f"Successfully saved tracking to {OUTPUT_JSON_PUBLIC} and {OUTPUT_JSON_SRC}!")
