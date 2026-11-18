#!/bin/bash
# Download CME295 lectures (720p mp4) from Stanford Online. Autumn 2026, L1-L6 released.
# Usage: fetch_videos.sh [1|2]  — two parallel groups of three lectures.
OUT=/Users/baoxiehao/Workspace/Creation/courses/cme295/lectures
GROUP="${1:-all}"
fetch() {
  echo "=== $1 ($2) $(date +%H:%M:%S) ==="
  python3.14 -m yt_dlp \
    -f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b" \
    --merge-output-format mp4 \
    --proxy "" \
    --concurrent-fragments 8 \
    --cookies-from-browser chrome \
    -o "$OUT/$1 [%(id)s].mp4" \
    "https://youtu.be/$2" 2>&1 | grep -E "100%|ERROR|has already been downloaded" | tail -2
}
case "$GROUP" in
  1) fetch L01-transformers          114i2Kz-LZA
     fetch L02-large-language-models GaIeu3npx04
     fetch L03-llm-training          S3bCDcJhz4s ;;
  2) fetch L04-rl-with-llms          3Vaj0Oka_t4
     fetch L05-llm-systems           25KIyaeI_Fg
     fetch L06-ai-agents             nU2a2lm6vDE ;;
  *) fetch L01-transformers          114i2Kz-LZA
     fetch L02-large-language-models GaIeu3npx04
     fetch L03-llm-training          S3bCDcJhz4s
     fetch L04-rl-with-llms          3Vaj0Oka_t4
     fetch L05-llm-systems           25KIyaeI_Fg
     fetch L06-ai-agents             nU2a2lm6vDE ;;
esac
echo "=== GROUP $GROUP DONE ==="
