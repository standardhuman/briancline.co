#!/usr/bin/env bash
# Telegram alert for .github/workflows/site-smoke.yml.
#
# Sends a message only when the result changes: on the first failing run after
# a passing one, and once when it passes again. Repeat failures stay quiet.
#
# Env: OUTCOME (success|failure), RUN_URL, RUN_ID, GITHUB_REPOSITORY, GH_TOKEN,
#      TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. REPORT defaults to the Playwright
#      JSON report written by playwright.smoke.config.js.
set -euo pipefail

: "${OUTCOME:?}" "${RUN_URL:?}" "${RUN_ID:?}" "${GITHUB_REPOSITORY:?}"
REPORT="${REPORT:-test-results/smoke-report.json}"

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "::notice::TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set, so no Telegram alert. GitHub's failure email still applies."
  exit 0
fi

# Result of the last finished run on main (cancelled runs ignored). With no
# history, or if the lookup fails, assume it passed: a failure then always
# alerts, and a pass stays quiet.
prev=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow site-smoke.yml --branch main \
  --status completed --limit 20 --json databaseId,conclusion \
  --jq "[.[] | select(.databaseId != $RUN_ID) | select(.conclusion == \"success\" or .conclusion == \"failure\")][0].conclusion // \"success\"") || prev=success

if [[ "$OUTCOME" == "failure" && "$prev" == "success" ]]; then
  failures=""
  if [[ -f "$REPORT" ]]; then
    # One line per failed check: its failure message, which names the surface
    # and the likely cause. Colour codes and the "Error: " prefix are dropped.
    failures=$(jq -r '
      [.. | objects | select(has("specs")) | .specs[] | select(.ok == false)
        | (.tests[0].results[-1].error.message // (.title + ": failed"))
        | gsub("\u001b\\[[0-9;]*m"; "") | sub("^Error: "; "") | split("\n")[0] | .[0:300]
        | "- " + .] | .[0:6] | join("\n")' "$REPORT")
  fi
  [[ -n "$failures" ]] || failures="- The checks did not run (a setup step failed). See the run log."
  text=$(printf 'briancline.co site check FAILED\n\n%s\n\n%s' "$failures" "$RUN_URL")
elif [[ "$OUTCOME" == "success" && "$prev" == "failure" ]]; then
  text=$(printf 'briancline.co site check is passing again.\n\n%s' "$RUN_URL")
else
  echo "Result $OUTCOME, same as the last run ($prev). No Telegram alert."
  exit 0
fi

code=$(curl -sS -o /dev/null -w '%{http_code}' \
  --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
  --data-urlencode "text=$text" \
  "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage") || code="curl error"
if [[ "$code" == "200" ]]; then
  echo "Telegram alert sent ($OUTCOME, last run was $prev)."
else
  echo "::warning::Telegram alert failed (HTTP $code). GitHub's failure email still applies."
fi
