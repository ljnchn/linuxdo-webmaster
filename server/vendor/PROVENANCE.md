# mapp verification provenance

`platform-server.mjs` is the official `sdk/server.mjs` previously retrieved from https://github.com/linux-do/mapp-developer-guide, Git blob SHA `305039df9398e1cc4bd39a9a2cb6f676484e2c8c` (2026-11-10).

`worker/platform-verifier.mjs` retains its claim, URL, scope, channel and JWT validation. Only Node crypto/Buffer operations are adapted to Cloudflare's standard WebCrypto, Uint8Array, atob and btoa. Tests exercise both verifiers with temporary in-memory keys. No real keys or tokens are included. Production activation still requires platform registration and sandbox verification.
