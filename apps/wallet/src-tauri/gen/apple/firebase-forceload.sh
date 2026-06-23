#!/usr/bin/env bash
#
# firebase-forceload.sh — build a small static archive of just the Firebase /
# Google Objective-C/C objects so the iOS link can `-force_load` them.
#
# WHY THIS EXISTS
# ---------------
# Firebase Crashlytics arms its NSException + Mach/signal crash handlers from
# Objective-C `+load` methods and categories that nothing in our code
# references directly. The linker dead-strips those object files unless told
# to force-load them — without it, FirebaseApp.configure() links and runs but
# NO crash is ever captured/uploaded.
#
# Firebase's documented fix is `-ObjC`, which force-loads EVERY Obj-C member of
# EVERY static library on the link line. But Firebase is merged (via swift-rs)
# into the single `libapp.a`, which also bundles 13 duplicate copies of the
# shared Tauri / SwiftRs Swift glue (Tauri.swift.o, lib.swift.o, …). `-ObjC`
# force-loaded all of them → 317 duplicate symbols and a failed link.
#
# Instead we extract ONLY the uniquely-named Obj-C/C members (every Firebase
# FIR*/GUL*/GDT*/nanopb/… object is unique; the duplicated members are all
# `.swift.o` glue, plus resource_bundle_accessor.m.o / dummy.m.o) into a
# dedicated archive and `-force_load` THAT. Crashlytics' handlers survive, and
# the duplicated glue is still resolved lazily (one copy each) from libapp.a.
#
# Invoked from the "Build Rust Code" Xcode build phase (see project.yml), after
# `tauri ios xcode-script` has produced libapp.a for the active ARCHS.
set -euo pipefail

: "${ARCHS:?ARCHS must be set by Xcode}"
: "${CONFIGURATION:?CONFIGURATION must be set by Xcode}"
: "${SRCROOT:?SRCROOT must be set by Xcode}"

for arch in ${ARCHS}; do
  lib="${SRCROOT}/Externals/${arch}/${CONFIGURATION}/libapp.a"
  out="${SRCROOT}/Externals/${arch}/${CONFIGURATION}/libfirebase_objc.a"

  if [ ! -f "${lib}" ]; then
    echo "warning: ${lib} not found; skipping Firebase force-load archive for ${arch}"
    continue
  fi

  # Uniquely-named Obj-C/C members only. The `.swift.o` glue is excluded by the
  # suffix filter; `uniq -u` then drops the only duplicated Obj-C members
  # (resource_bundle_accessor.m.o, dummy.m.o) — neither is needed for
  # crash-handler registration. Everything left is unique → no duplicate
  # symbols when force-loaded.
  members="$(ar t "${lib}" | grep -E '\.(m|mm|c)\.o$' | sort | uniq -u)"
  if [ -z "${members}" ]; then
    echo "error: no unique Obj-C/C members found in ${lib}" >&2
    exit 1
  fi

  work="$(mktemp -d)"
  # shellcheck disable=SC2086 # members is intentionally word-split (one per line)
  ( cd "${work}" && ar x "${lib}" ${members} && libtool -static -o "${out}" ./*.o )
  rm -rf "${work}"

  # Fail loudly if the Crashlytics crash-handler objects didn't make it in — a
  # silently empty/incomplete archive would re-break crash capture. Use `grep
  # -c` (reads all input) rather than `grep -q` (closes the pipe early, which
  # SIGPIPEs `nm` and trips `set -o pipefail` with a false failure).
  handler_syms="$(nm "${out}" 2>/dev/null | grep -c 'FIRCLSHandler' || true)"
  if [ "${handler_syms}" -eq 0 ]; then
    echo "error: ${out} is missing Crashlytics handler symbols (FIRCLSHandler)" >&2
    exit 1
  fi

  echo "Built Firebase force-load archive: ${out} ($(du -h "${out}" | cut -f1), $(printf '%s\n' "${members}" | wc -l | tr -d ' ') members)"
done
