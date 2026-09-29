import json

with open('Remotion/src/transcript.json', 'r') as f:
    words = json.load(f)

chunks = []
curr = []

for i, w in enumerate(words):
    curr.append(w)
    is_major_punct = any(p in w.get('punctuated', '') for p in ['.', '?', '!'])
    pause = False
    if i < len(words) - 1:
        next_w = words[i+1]
        if next_w['start'] - w['end'] > 0.4:
            pause = True
            
    # Keep at least 2 words per chunk unless a long pause occurs
    if (len(curr) >= 3 and (is_major_punct or pause)) or len(curr) >= 4:
        chunks.append(curr)
        curr = []
    elif len(curr) >= 2 and pause:
        chunks.append(curr)
        curr = []
        
if curr:
    if len(curr) == 1 and len(chunks) > 0:
        chunks[-1].extend(curr)
    else:
        chunks.append(curr)

print(f"Total polished chunks: {len(chunks)}")
for idx, ch in enumerate(chunks[:10]):
    lines = [w['punctuated'] for w in ch]
    t0, t1 = ch[0]['start'], ch[-1]['end']
    f0, f1 = int(round(t0 * 30)), int(round(t1 * 30))
    print(f"Chunk {idx} [{f0}..{f1}]:")
    for l in lines:
        print(f"   -> {l}")
