#!/bin/bash
# Download CS25 V6 lectures (720p mp4) from Stanford Online. Spring 2026, all 9 talks released.
# Usage: fetch_videos.sh [1|2] — two parallel groups.
OUT=/Users/baoxiehao/Workspace/Creation/courses/cs25/lectures
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
  1) fetch L01-overview                     bHSDPgZYie0
     fetch L02-jepa-world-models            GBd7iuJkW08
     fetch L03-ssm-tradeoffs                OyimE74UMF8
     fetch L04-ultra-scale-training         I5BKi32IEa8
     fetch L05-pretraining-future           e_H_tkpCAK4 ;;
  2) fetch L06-generalization-params-context dJtHauhRasc
     fetch L07-ai-science-medicine          jFdH7n6BAl0
     fetch L08-native-multimodal            NDdc39KYqDU
     fetch L09-serving-transformers         ZUdIsRZhWXI ;;
  *)
     fetch L01-overview                     bHSDPgZYie0
     fetch L02-jepa-world-models            GBd7iuJkW08
     fetch L03-ssm-tradeoffs                OyimE74UMF8
     fetch L04-ultra-scale-training         I5BKi32IEa8
     fetch L05-pretraining-future           e_H_tkpCAK4
     fetch L06-generalization-params-context dJtHauhRasc
     fetch L07-ai-science-medicine          jFdH7n6BAl0
     fetch L08-native-multimodal            NDdc39KYqDU
     fetch L09-serving-transformers         ZUdIsRZhWXI ;;
esac
echo "=== GROUP $GROUP DONE ==="
