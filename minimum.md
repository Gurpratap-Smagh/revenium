# Minimum Viable Setup

The new front-end assumes a lightweight but working Solana environment. Keep the following items in place before running the dApp:

- **Program deployment**  
  Build and deploy `programs/skill_stake` with Anchor on devnet. Update `Anchor.toml` with the deployed program id and confirm the generated IDL is written to `idl/skill_stake.json` (the front-end consumes this file).

- **Token mint + state init**  
  Make sure the staking mint exists and that the program is initialised (vault, state PDA, mint authority) via your existing scripts (e.g. `scripts/devnet_init.ts`). Record the mint public key - it is required by the UI.

- **Environment values**  
  Copy `app/.env.example` to `app/.env` and set:
  ```
  VITE_SOLANA_RPC_ENDPOINT=<devnet RPC URL>
  VITE_SKILL_STAKE_PROGRAM_ID=<program id>
  VITE_SKILL_STAKE_MINT=<staking mint>
  VITE_TOKEN_DECIMALS=<mint decimals>
  VITE_FAUCET_AMOUNT=100
  ```
  The faucet button expects the connected wallet to be the same admin signer that initialised the program.

- **Oracle / proof configuration**  
  After deployment, call the new admin instructions (set_apr, update_faucet_cap, set_oracle_authority) and oracle instruction (set_pow_config) as needed to tune APR, faucet limits, and proof-of-work difficulty/reward. The oracle update requires a strictly increasing nonce to prevent stale updates.

- **Workspace contracts**  
  Keep the `token/` and `oracle/` packages at parity with the program state you deployed. They should expose any helper scripts you already rely on (minting, funding, oracle updates) so the UI interactions stay consistent.

- **Front-end install**  
  Inside `app/`, run `npm install` once, then `npm run dev` for local testing or `npm run build` for production output. The front-end is a single-page React app powered by Recoil, React Router, and the Solana wallet adapter.

With these pieces aligned, the dApp can connect wallets, mint dev tokens through the faucet, and send stake transactions against the deployed program.
