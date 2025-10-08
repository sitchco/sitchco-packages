#!/usr/bin/env sh

usage() {
  cat >&2 <<'EOF'
Usage: ddev-run.sh <workdir> <command> [args...]
Runs a command inside DDEV when available, otherwise on the host.
Set DDEV_RUN_ENFORCE=1 to make fallback failures exit non-zero.
EOF
  exit 1
}

[ "$#" -ge 2 ] || usage

workdir_input=$1
shift

if ! workdir=$(cd "$workdir_input" 2>/dev/null && pwd -P); then
  echo "Unable to access workdir: $workdir_input" >&2
  exit 1
fi

container_root=${DDEV_RUN_CONTAINER_ROOT:-/var/www/html}
enforce=${DDEV_RUN_ENFORCE:-0}

run_on_host() {
  wd=$1
  shift
  (
    cd "$wd" || exit 1
    "$@"
  )
}

is_ddev_running() {
  (
    cd "$1" || exit 1
    ddev describe >/dev/null 2>&1
  )
}

run_fallback() {
  if run_on_host "$workdir" "$@"; then
    return 0
  fi
  status=$?
  if [ "$enforce" = "1" ]; then
    return $status
  fi
  echo "Command '$*' failed on host (status $status); continuing. Set DDEV_RUN_ENFORCE=1 to fail." >&2
  return 0
}

if [ -n "${IS_DDEV_PROJECT-}" ] && [ "${IS_DDEV_PROJECT}" != "false" ]; then
  run_on_host "$workdir" "$@"
  exit $?
fi

if command -v ddev >/dev/null 2>&1; then
  ddev_root=$workdir
  while [ "$ddev_root" != "/" ] && [ ! -d "$ddev_root/.ddev" ]; do
    ddev_root=$(dirname "$ddev_root")
  done

  if [ -d "$ddev_root/.ddev" ]; then
    if is_ddev_running "$ddev_root"; then
      rel_path="."
      case "$workdir/" in
        "$ddev_root/"*)
          rel_path=${workdir#"$ddev_root"/}
          [ -z "$rel_path" ] && rel_path="."
          ;;
      esac
      container_target=$container_root
      [ "$rel_path" != "." ] && container_target="$container_root/$rel_path"

      if (cd "$ddev_root" && ddev exec --dir "$container_target" "$@"); then
        exit 0
      else
        status=$?
        if [ "$enforce" = "1" ]; then
          exit $status
        fi
        echo "ddev exec failed (status $status); falling back to host execution." >&2
      fi
    else
      echo "ddev project detected but not running; falling back to host execution." >&2
    fi
  else
    echo "No .ddev directory found above $workdir; running on host." >&2
  fi
else
  echo "ddev command not available; running on host." >&2
fi

run_fallback "$@"
exit $?
