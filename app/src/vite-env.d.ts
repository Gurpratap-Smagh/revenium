/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_RPC_ENDPOINT?: string
  readonly VITE_SOLANA_CLUSTER?: string
  readonly VITE_SKILL_STAKE_PROGRAM_ID?: string
  readonly VITE_SKILL_STAKE_MINT?: string
  readonly VITE_TOKEN_DECIMALS?: string
  readonly VITE_FAUCET_AMOUNT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
