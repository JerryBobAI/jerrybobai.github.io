#!/bin/bash
# Download CS336 lectures (720p mp4) from Stanford Online. Spring 2025, L1-L17 released (L18/L19 guest lectures not on YouTube).
# Usage: fetch_videos.sh [1|2|3] — three parallel groups.
OUT=/Users/baoxiehao/Workspace/Creation/courses/cs336/lectures
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
  1) fetch L01-overview-tokenization   SQ3fZ1sAqXI
     fetch L02-pytorch-resources       msHyYioAyNE
     fetch L03-architectures           ptFiH_bHnJw
     fetch L04-mixture-of-experts      LPv1KfUXLCo
     fetch L05-gpus                    6OBtO9niT00
     fetch L06-kernels-triton          E8Mju53VB00 ;;
  2) fetch L07-parallelism-1           l1RJcDjzK8M
     fetch L08-parallelism-2           LHpr5ytssLo
     fetch L09-scaling-laws-1          6Q-ESEmDf4Q
     fetch L10-inference               fcgPYo3OtV0
     fetch L11-scaling-laws-2          OSYuUqGBQxw
     fetch L12-evaluation              x-R5l2HsXqM ;;
  3) fetch L13-data-1                  WePxmeXU1xg
     fetch L14-data-2                  9Cd0THLS1t0
     fetch L15-alignment-sft-rlhf      Dfu7vC9jo4w
     fetch L16-alignment-rl-1          46f2QTDB08Q
     fetch L17-alignment-rl-2          JdGFdViaOJk ;;
  *) for spec in \
       "L01-overview-tokenization SQ3fZ1sAqXI" \
       "L02-pytorch-resources msHyYioAyNE" \
       "L03-architectures ptFiH_bHnJw" \
       "L04-mixture-of-experts LPv1KfUXLCo" \
       "L05-gpus 6OBtO9niT00" \
       "L06-kernels-triton E8Mju53VB00" \
       "L07-parallelism-1 l1RJcDjzK8M" \
       "L08-parallelism-2 LHpr5ytssLo" \
       "L09-scaling-laws-1 6Q-ESEmDf4Q" \
       "L10-inference fcgPYo3OtV0" \
       "L11-scaling-laws-2 OSYuUqGBQxw" \
       "L12-evaluation x-R5l2HsXqM" \
       "L13-data-1 WePxmeXU1xg" \
       "L14-data-2 9Cd0THLS1t0" \
       "L15-alignment-sft-rlhf Dfu7vC9jo4w" \
       "L16-alignment-rl-1 46f2QTDB08Q" \
       "L17-alignment-rl-2 JdGFdViaOJk" ; do
       fetch $spec
     done ;;
esac
echo "=== GROUP $GROUP DONE ==="
