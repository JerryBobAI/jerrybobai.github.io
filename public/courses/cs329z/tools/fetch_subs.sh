#!/bin/bash
# Batch-fetch English auto-subs for CS329Z lectures L2-L8 (bash 3.2 compatible: no assoc arrays)
OUT=/Users/baoxiehao/Projects/courses/cs329z/notes
fetch() {
  echo "=== $1 ($2) ==="
  yt-dlp --cookies-from-browser chrome --skip-download \
    --write-auto-subs --sub-langs "en" --sub-format vtt \
    -o "$OUT/$1" "https://youtu.be/$2" 2>&1 | grep -E "Writing video subtitles|ERROR" | head -3
}
fetch L02-context-engineering        Vr1NzH8bT44
fetch L03-rag                        psLc-46GqY0
fetch L04-tools-mcp                  s0S38lz6O7M
fetch L05-frameworks-dspy-langgraph  q0Q-Hy8TTps
fetch L06-design-patterns            JC_pLC5EX_w
fetch L07-agent-memory               qh5tP6PBZ6U
fetch L08-multi-agent                TlX_ft_PQIM
echo "=== ALL DONE ==="
ls -la $OUT/*.vtt
