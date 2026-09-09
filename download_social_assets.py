import os
import json
import hashlib
import urllib.request
import urllib.parse
import re
import subprocess

# Configuration
JSON_PATH = os.path.join("src", "SocialMediaEmbed", "social-embed.json")
PUBLIC_DIR = "public"
TARGET_DIR = os.path.join(PUBLIC_DIR, "SocialMediaEmbed")

# Headers to mimic a modern browser and bypass CORS/403 blocks on Twitter/Instagram
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://twitter.com/',
    'Origin': 'https://twitter.com',
}

def get_file_extension(url, default=".mp4"):
    parsed = urllib.parse.urlparse(url)
    path = parsed.path
    ext = os.path.splitext(path)[1]
    if ext:
        ext = re.sub(r'[^a-zA-Z0-9\.]', '', ext)
        return ext
    return default

def download_file(url, target_path):
    print(f"Downloading: {url} -> {target_path}")
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as response:
            with open(target_path, 'wb') as f:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
        print("Download complete.")
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

def process_url(url, prefix, default_ext):
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return url
    
    url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()
    ext = get_file_extension(url, default_ext)
    filename = f"{prefix}_{url_hash}{ext}"
    
    os.makedirs(TARGET_DIR, exist_ok=True)
    target_path = os.path.join(TARGET_DIR, filename)
    
    if not os.path.exists(target_path):
        success = download_file(url, target_path)
        if not success:
            return url
    else:
        print(f"Asset already downloaded: {target_path}")
        
    return f"SocialMediaEmbed/{filename}"

def get_video_dimensions(file_path):
    # Try using ffprobe (requires ffmpeg/ffprobe to be installed, which Remotion users have)
    try:
        cmd = [
            'ffprobe', 
            '-v', 'error', 
            '-select_streams', 'v:0', 
            '-show_entries', 'stream=width,height', 
            '-of', 'json', 
            file_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        info = json.loads(result.stdout)
        if 'streams' in info and len(info['streams']) > 0:
            width = info['streams'][0]['width']
            height = info['streams'][0]['height']
            print(f"Extracted dimensions via ffprobe: {width}x{height}")
            return int(width), int(height)
    except Exception as e:
        print(f"ffprobe extraction failed: {e}")
    return None

def main():
    print("=" * 60)
    print("SocialMediaEmbed Local Asset Downloader")
    print("=" * 60)
    
    if not os.path.exists(JSON_PATH):
        print(f"Error: JSON file not found at {JSON_PATH}")
        return
        
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)
        
    modified = False
    
    # Process avatar URL
    profile = config.get("profile", {})
    avatar = profile.get("avatar")
    if avatar and (avatar.startswith("http://") or avatar.startswith("https://")):
        local_avatar = process_url(avatar, "avatar", ".png")
        if local_avatar != avatar:
            profile["avatar"] = local_avatar
            modified = True
            
    # Process video URL
    post = config.get("post", {})
    video = post.get("video")
    
    video_url_for_dim_parse = None
    if video:
        if video.startswith("http://") or video.startswith("https://"):
            video_url_for_dim_parse = video
            local_video = process_url(video, "video", ".mp4")
            if local_video != video:
                post["video"] = local_video
                modified = True
        else:
            # Video is already local, let's keep it
            local_video = video
            
        # Ensure we have video dimensions
        if "videoWidth" not in post or "videoHeight" not in post:
            dimensions = None
            # 1. Try URL parsing if we have the original URL
            if video_url_for_dim_parse:
                url_match = re.search(r'/(\d+)x(\d+)/', video_url_for_dim_parse)
                if url_match:
                    dimensions = (int(url_match.group(1)), int(url_match.group(2)))
                    print(f"Extracted dimensions from URL: {dimensions[0]}x{dimensions[1]}")
            
            # 2. Try ffprobe on downloaded file
            if not dimensions:
                # Find local path
                local_path = os.path.join(PUBLIC_DIR, local_video)
                if os.path.exists(local_path):
                    dimensions = get_video_dimensions(local_path)
            
            if dimensions:
                post["videoWidth"] = dimensions[0]
                post["videoHeight"] = dimensions[1]
                modified = True

    # Process images list
    images = post.get("images")
    if images and isinstance(images, list):
        new_images = []
        for img in images:
            if img.startswith("http://") or img.startswith("https://"):
                local_img = process_url(img, "image", ".png")
                if local_img != img:
                    new_images.append(local_img)
                    modified = True
                else:
                    new_images.append(img)
            else:
                new_images.append(img)
        if modified:
            post["images"] = new_images

    # Save updated JSON if changes were made
    if modified:
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print("Updated social-embed.json with local assets and metadata!")
    else:
        print("No remote assets needed downloading or all already downloaded.")
        
    print("=" * 60)

if __name__ == "__main__":
    main()
