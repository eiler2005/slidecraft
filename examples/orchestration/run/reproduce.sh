#!/usr/bin/env bash
# Recreates the example run from scratch: all output formats, PowerPoint renders, the visual-QA
# pack, the two recorded review rounds, REPORT.md and REVIEW-LOG.md.
# Needs PowerPoint (or LibreOffice), Chrome and Poppler. Run from the repository root:
#   bash examples/orchestration/run/reproduce.sh
set -euo pipefail
RUN=examples/orchestration/run
D=$RUN/pitch-deck
# Binary outputs live under docs/showcase/ (the repository keeps binaries out of examples/).
OUT=docs/showcase/orchestration-run
sc() { npx tsx src/cli/main.ts "$@"; }

rm -rf "$OUT" "$D/review-log.jsonl" "$D/REVIEW-LOG.md"
cp examples/pitch-deck/deck.yaml "$D/deck.yaml"
sed -i.bak 's#\$schema=../../schemas/deck.v1.json#$schema=../../../../schemas/deck.v1.json#' "$D/deck.yaml" && rm "$D/deck.yaml.bak"

# Stage 6b, round 1: pack → review (findings-round-1.json) → content fixes → record
sc visual-qa "$D/deck.yaml" --out "$OUT" --json > /dev/null
python3 - "$D/deck.yaml" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
s = s.replace("      headline: Growth is organic and repeat-driven", "      headline: Organic, repeat-driven growth")
anchor = "      - { label: Tailspin Board, x: 0.62, y: 0.42 }\n"
s = s.replace(anchor, anchor + "    takeaway: Only Fabrikam books in minutes and is built for shippers moving under 50 loads a month\n")
open(p, "w").write(s)
PY
cp "$RUN/findings-round-1.json" "$OUT/visual-qa/findings-1.json"
sc visual-qa "$D/deck.yaml" --out "$OUT" --record "$OUT/visual-qa/findings-1.json" --json > /dev/null

# Round 2: rebuilt pack → review → record
sc visual-qa "$D/deck.yaml" --out "$OUT" --json > /dev/null
cp "$RUN/findings-round-2.json" "$OUT/visual-qa/findings-2.json"
sc visual-qa "$D/deck.yaml" --out "$OUT" --record "$OUT/visual-qa/findings-2.json" --json > /dev/null

# Stage 7: deliverables in every format, plus PowerPoint renders of the editable PPTX
sc build "$D/deck.yaml" -f pptx,png --png-engine pptx-convert -o "$OUT" --json > /dev/null
sc build "$D/deck.yaml" -f pptx,pdf,png,html,onepager,docx -o "$OUT" --json > /dev/null
rm -rf "$OUT/visual-qa/build" "$OUT/visual-qa/pptx-office.pdf"
echo "Done: $D"
