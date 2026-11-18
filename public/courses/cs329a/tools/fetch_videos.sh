#!/bin/bash
# Download CS329A lectures (720p mp4) from Stanford Online.
# Usage: fetch_videos.sh [1|2|3]  — three parallel groups of three lectures.
OUT=/Users/baoxiehao/Workspace/Creation/courses/cs329a/lectures
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
  1) fetch L01-course-overview        6YnLB0XbTnI
     fetch L02-test-time-compute      -Ggc37xLj_Y
     fetch L03-robust-verification    p7TdPUcPoik ;;
  2) fetch L04-feedback-tools-code    Lxh9RF5S-K0
     fetch L05-planning-reasoning     Ml_fp9XkB8Y
     fetch L06-train-time-scaling     yVnmHSAy3ck ;;
  3) fetch L07-deep-research-agents   Uni9dqyuuDM
     fetch L08-agentic-evaluations    8JAqLnTaZu4
     fetch L09-future-research        AyO6wyu4DEg ;;
  *) fetch L01-course-overview        6YnLB0XbTnI
     fetch L02-test-time-compute      -Ggc37xLj_Y
     fetch L03-robust-verification    p7TdPUcPoik
     fetch L04-feedback-tools-code    Lxh9RF5S-K0
     fetch L05-planning-reasoning     Ml_fp9XkB8Y
     fetch L06-train-time-scaling     yVnmHSAy3ck
     fetch L07-deep-research-agents   Uni9dqyuuDM
     fetch L08-agentic-evaluations    8JAqLnTaZu4
     fetch L09-future-research        AyO6wyu4DEg ;;
esac
echo "=== GROUP $GROUP DONE ==="
