## Follow-up Actions

- Install the Anchor CLI (v0.30.1) and run `anchor build` to regenerate the program IDL and binary with the updated on-chain logic.
- Redeploy the `skill_stake` program (`anchor deploy`) so the new instructions and account layouts are available on-chain.
- After deployment, update `Anchor.toml`/environment variables with the new program ID (if it changed) before starting the frontend.
