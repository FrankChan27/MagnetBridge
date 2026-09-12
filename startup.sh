#!/bin/sh
# Restart contract: preview must be on 0.0.0.0:8080 via npm run dev.
set -eu
cd /workspace

if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi

npm run dev -- --host 0.0.0.0 --port 8080 >/tmp/magnetbridge-dev.log 2>&1 &
pid=$!

for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "dev server exited" >&2
    tail -n 80 /tmp/magnetbridge-dev.log >&2 || true
    exit 1
  fi
  sleep 0.5
done

echo "dev server did not become healthy" >&2
tail -n 80 /tmp/magnetbridge-dev.log >&2 || true
exit 1
