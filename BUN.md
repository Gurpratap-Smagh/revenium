Quickstart: Bun

- Install Bun (Windows PowerShell):
  - Set-ExecutionPolicy -Scope Process Bypass; iwr https://bun.sh/install.ps1 -UseBasicParsing | iex

- Use Bun for everything in this repo:
- bun install                           # installs all workspaces
- bun run --filter app dev              # start Vite dev server
- bun run --filter app build            # build the app
- bun run build:program                 # anchor build (root script)

Env for scripts (root .env)
- PROGRAM_ID=YourProgramId
- REWARD_MINT=YourMintAddress
- APR_BPS=1000
- FAUCET_CAP=100000000000   # raw units
- POW_REWARD=0              # raw units
- POW_DIFFICULTY=18
- ORACLE_AUTHORITY=<optional Pubkey>

Notes
- packageManager is set to bun@1.3.1 in package.json files.
- package-lock.json may still exist from npm; Bun creates bun.lockb and uses that.
