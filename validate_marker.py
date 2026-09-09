import cv2
import numpy as np
import sys
import os

def check_marker(image_path):
    img = cv2.imread(image_path)
    if img is None:
        print(f"Failed to load {image_path}")
        return None

    # Convert to HSV for better color thresholding
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Target color is #FFD42A -> RGB(255, 212, 42)
    # HSV bounds for this yellow
    lower_yellow = np.array([15, 100, 100])
    upper_yellow = np.array([35, 255, 255])
    
    mask = cv2.inRange(hsv, lower_yellow, upper_yellow)
    
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
        
    # Get the largest contour assuming it's the marker
    c = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(c)
    
    return {
        'centerX': x + w // 2,
        'centerY': y + h // 2,
        'width': w,
        'height': h
    }

def main():
    frames_dir = "out/frames"
    if not os.path.exists(frames_dir):
        print(f"Directory {frames_dir} not found. Generate frames first.")
        return

    results = []
    # Test specific frames as requested: [0, 4, 8, 12, 15, 19, 23, 27, 30, 34, 38, 42, 45, 49, 53, 57, 60, 64, 68, 72]
    target_frames = [0, 4, 8, 12, 15, 19, 23, 27, 30, 34, 38, 42, 45, 49, 53, 57, 60, 64, 68, 72]
    
    print("State   CenterX   CenterY   Width   Height   Pass")
    print("-" * 55)
    
    all_x = []
    all_y = []
    all_w = []
    
    for i, frame in enumerate(target_frames):
        # Remotion typically names frames like "frame-00000.png"
        filename = f"element-{frame:05d}.jpeg" # Remotion still uses default naming if we use remotion still
        filepath = os.path.join(frames_dir, filename)
        
        # If still command was used: `npx remotion still PaperHighlightReplica out/frames/element.png --frame=N`
        # Let's just search for any matching frame format
        filepath = os.path.join(frames_dir, f"frame-{frame:05d}.png")
        if not os.path.exists(filepath):
            filepath = os.path.join(frames_dir, f"frame_{frame}.png")
            
        if not os.path.exists(filepath):
            continue

        res = check_marker(filepath)
        if res:
            all_x.append(res['centerX'])
            all_y.append(res['centerY'])
            all_w.append(res['width'])
            
            # Tolerances
            cx_target = 540
            cy_target = 557
            passed = abs(res['centerX'] - cx_target) <= 8 and abs(res['centerY'] - cy_target) <= 8
            
            print(f"{i+1:02d}      {res['centerX']:<9} {res['centerY']:<9} {res['width']:<7} {res['height']:<8} {'yes' if passed else 'no'}")
        else:
            print(f"{i+1:02d}      Marker not found")

    if all_x:
        print("-" * 55)
        print(f"X Range: {max(all_x) - min(all_x)}px")
        print(f"Y Range: {max(all_y) - min(all_y)}px")
        
        # Check width variation < 4%
        avg_w = sum(all_w) / len(all_w)
        max_w_diff = max([abs(w - avg_w) for w in all_w])
        variation = (max_w_diff / avg_w) * 100
        print(f"Width Variation: {variation:.1f}%")

if __name__ == "__main__":
    main()
