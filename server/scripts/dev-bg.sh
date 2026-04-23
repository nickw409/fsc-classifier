#!/usr/bin/env bash
# Background server control for the dev workflow.
#
#   npm run dev:bg        start tsx watch in background, log to /tmp/fsc-srv.log
#   npm run dev:stop      kill the process group recorded on start
#   npm run dev:restart   stop if running, then start
#   npm run dev:status    running? with PID
#   npm run dev:log       tail -f the log
#
# Uses setsid so the PID we record is also a process-group leader — one
# kill -TERM -<pgid> takes down npx, tsx, and node together. Avoids the
# "pkill repeatedly" routine.

set -euo pipefail

cd "$(dirname "$0")/.."

PIDFILE=${FSC_SRV_PIDFILE:-/tmp/fsc-srv.pid}
LOGFILE=${FSC_SRV_LOGFILE:-/tmp/fsc-srv.log}

is_alive() {
  local pid=$1
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid() {
  [[ -f "$PIDFILE" ]] && cat "$PIDFILE" || true
}

cmd_start() {
  local existing
  existing=$(read_pid)
  if is_alive "$existing"; then
    echo "already running (pid $existing); log=$LOGFILE"
    return 0
  fi
  rm -f "$LOGFILE"
  # setsid makes the child its own process-group leader so killing -PGID
  # reaches all descendants (npx -> sh -> tsx -> node).
  setsid bash -c 'exec npx tsx watch src/index.ts' >"$LOGFILE" 2>&1 </dev/null &
  local pid=$!
  echo "$pid" >"$PIDFILE"
  disown
  # Wait up to 5s for [server] listening line or obvious failure.
  local i
  for i in $(seq 1 25); do
    if grep -q '\[server\] listening' "$LOGFILE" 2>/dev/null; then
      break
    fi
    if ! is_alive "$pid"; then
      echo "failed to start; log tail:"
      tail -20 "$LOGFILE" || true
      rm -f "$PIDFILE"
      exit 1
    fi
    sleep 0.2
  done
  echo "started pid=$pid log=$LOGFILE"
}

cmd_stop() {
  local pid
  pid=$(read_pid)
  if [[ -z "$pid" ]]; then
    echo "not running (no pidfile)"
    return 0
  fi
  if ! is_alive "$pid"; then
    rm -f "$PIDFILE"
    echo "stale pidfile removed"
    return 0
  fi
  # pid == pgid because of setsid. Negative arg targets the whole group.
  kill -TERM -"$pid" 2>/dev/null || true
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    is_alive "$pid" || break
    sleep 0.2
  done
  if is_alive "$pid"; then
    kill -KILL -"$pid" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
  echo "stopped"
}

cmd_restart() {
  cmd_stop
  cmd_start
}

cmd_status() {
  local pid
  pid=$(read_pid)
  if is_alive "$pid"; then
    echo "running pid=$pid log=$LOGFILE"
  else
    echo "not running"
  fi
}

cmd_log() {
  exec tail -n +1 -f "$LOGFILE"
}

case "${1:-}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  log)     cmd_log ;;
  *)       echo "usage: $0 {start|stop|restart|status|log}" >&2; exit 2 ;;
esac
