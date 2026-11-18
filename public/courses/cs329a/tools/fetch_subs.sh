#!/bin/bash
# Batch-fetch English auto-subs for CS329A lectures L1-L9
OUT=/Users/baoxiehao/Workspace/Creation/courses/cs329a/notes
fetch() {
  echo "=== $1 ($2) ==="
  python3.14 -m yt_dlp --cookies-from-browser chrome --skip-download \
    --write-auto-subs --sub-langs "en" --sub-format vtt \
    -o "$OUT/$1" "https://youtu.be/$2" 2>&1 | grep -E "Writing video subtitles|ERROR" | head -3
}
fetch L01-course-overview        6YnLB0XbTnI
fetch L02-test-time-compute      -Ggc37xLj_Y
fetch L03-robust-verification    p7TdPUcPoik
fetch L04-feedback-tools-code    Lxh9RF5S-K0
fetch L05-planning-reasoning     Ml_fp9XkB8Y
fetch L06-train-time-scaling     yVnmHSAy3ck
fetch L07-deep-research-agents   Uni9dqyuuDM
fetch L08-agentic-evaluations    8JAqLnTaZu4
fetch L09-future-research        AyO6wyu4DEg
echo "=== ALL SUBS DONE ==="
ls -la $OUT/*.vtt
