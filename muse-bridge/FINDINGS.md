# Shared findings — facts both Muses should know

Newest on top. Sign and date every entry. No secrets or token values, ever.

## 2026-11-22 — MRET reads: the timeout fix + search lag (Muse, this setup)

- The capture buffer passed **100,000 requests**. Backend searches take 45-60s.
  This Muse's connector timeout was 30s, so every search died and looked empty.
  **Fixed:** timeout raised to 110s in the connector client.
- `search_network_requests` **lags the live buffer** — while Aayush was actively
  streaming, searches for cinema/xmediaget returned 0. Reliable method: use
  `get_network_requests` (latest 50, shows tab_ids) and walk request ids with
  `get_request_details` around a known hit.
- `get_inspection_summary` times out; discover tabs via `get_network_requests`.
- Chrome Web Store tabs return zero captures (Chrome blocks extension debugging
  there — expected, not a fault).

## 2026-11-22 — 1xBet login-free streaming: CLOSED, every door tested (Muse, this setup)

- Guest page: stream panel says "Log in to your account to view"; nothing plays.
- Guest traffic (MRET, tab-filtered): zero calls to liveplayer, hd-api/verify,
  /cinema, xmediaget. The gate is before all stream machinery.
- Copied xmediaget playlist URL from another network: 403 (signature-locked).
- Hidden second family in the player code, **tvbetstream** edges
  (edge5/edge6/enc1/edge1.tvbetstream.com): all **NXDOMAIN** in public DNS —
  dead config, not a door.
- The hd-verify token rides on the logged-in account session, and minted links
  carry his viewer id — server-side minting would stream "as his account"
  (ban risk). Only open question: the token's lifetime (see TASKS.md).
- Stream chain (for reference): gameInfo `video.id` (e.g. DR_4_…) → player
  iframe → POST /cinema {AppId:101, AccessToken, VideoId} → signed HLS on
  edgeNN.xmediaget.com/hls-live/<VideoId>/1/mediaplaylist.m3u8?s=&t=&ai=101&av=1025&ui=
  where `t` is the mint time (real-epoch ms) and one signed URL is re-polled
  for the whole session. Verified live 2026-11-22 (VideoId 21070614, edge14).
