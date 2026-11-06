# shellcheck shell=bash
# Sourced by e2e-{android,ios}.sh. Maestro passes a flow whose `when: visible` branch it skipped,
# so a green run proves only the branches this device's wallet state took: list the others.
# Usage: report_skipped_branches <debug output dir> <maestro exit status>
report_skipped_branches() {
	local log="$1/maestro.log"
	[ -f "$log" ] || return 0
	awk -v status="$2" '
		/ Running flow / { sub(/.* Running flow /, ""); sub(/\.\.\.$/, ""); flow = $0; next }
		# A suite run logs it from onCommandFinished, a single-flow run from runCommands.
		/\] [^ ]+: Run .* when ".*" is (not )?visible SKIPPED$/ {
			sub(/^[^]]*\] [^ ]+: /, ""); sub(/ SKIPPED$/, "")
			skipped[++n] = "  " flow ": " $0
		}
		END {
			if (n) {
				print "[wallet-e2e] Not proven by this run (this wallet'"'"'s state skipped them):"
				for (i = 1; i <= n; i++) print skipped[i]
			}
			# A failed flow stops before its later branches, so only a passing run proves them all.
			if (status != 0) print "[wallet-e2e] Branches after a failure were never reached."
			else if (!n) print "[wallet-e2e] Every state-dependent branch ran."
		}' "$log"
}
