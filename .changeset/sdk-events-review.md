---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

Review SDK analytics events against business KPIs. Removed events that don't map to dashboarded metrics (`wallet_button_clicked`, `share_error_debug_copied`, `modal_step_completed`, `install_code_success_modal_viewed`, `sharing_link_generated`, `user_referred_error`, `sdk_iframe_heartbeat_timeout`, `onboarding_keypass_opened`, `onboarding_step_advanced`) and trimmed bloated payloads (e.g. `debug_info` from `share_modal_error`). Consolidated redundant events into outcome-based terminal events: `banner_resolved { outcome }` (replaces `banner_clicked` + `banner_dismissed`) and `notification_opt_in_resolved { outcome }` (5 events → 1). Added coverage for gaps: `sharing_link_shared` / `sharing_link_copied` with unified `source` across all 5 entry points, auto-tracked `wallet_modal_opened` / `wallet_modal_closed`, `inapp_redirect` as an identity-merge source, and `sdk_init_failed` for CDN bootstrap failures. Full reference in `docs/openpanel-events.md`.
