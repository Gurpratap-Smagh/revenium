import "dotenv/config";
import * as anchor from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID_ENV = process.env.PROGRAM_ID;
const REWARD_MINT_ENV = process.env.REWARD_MINT;
const APR_BPS_ENV = process.env.APR_BPS ?? "1000";
const FAUCET_CAP_ENV = process.env.FAUCET_CAP ?? "100000000000"; // raw units
const POW_REWARD_ENV = process.env.POW_REWARD ?? "0"; // raw units
const POW_DIFFICULTY_ENV = process.env.POW_DIFFICULTY ?? "18"; // leading zero bits
const ORACLE_AUTHORITY_ENV = process.env.ORACLE_AUTHORITY; // optional; default to admin

async function main() {
  if (!PROGRAM_ID_ENV) {
    throw new Error("PROGRAM_ID env var is required");
  }
  if (!REWARD_MINT_ENV) {
    throw new Error("REWARD_MINT env var is required");
  }

  const programId = new PublicKey(PROGRAM_ID_ENV);
  const rewardMint = new PublicKey(REWARD_MINT_ENV);
  const aprBps = BigInt(APR_BPS_ENV);
  const faucetCap = BigInt(FAUCET_CAP_ENV);
  const powReward = BigInt(POW_REWARD_ENV);
  const powDifficulty = Number(POW_DIFFICULTY_ENV);

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = await anchor.Program.fetchIdl(programId, provider);
  if (!idl) {
    throw new Error(`Unable to fetch IDL for program ${programId.toBase58()}`);
  }

  const program = new anchor.Program(idl, programId, provider);

  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    programId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    programId
  );
  const [mintAuthPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_auth")],
    programId
  );

  console.log("Derived addresses:", {
    state: statePda.toBase58(),
    vault: vaultPda.toBase58(),
    mintAuth: mintAuthPda.toBase58(),
  });

  const oracleAuthority = ORACLE_AUTHORITY_ENV
    ? new PublicKey(ORACLE_AUTHORITY_ENV)
    : PublicKey.default;

  const txSig = await program.methods
    .initialize(
      new anchor.BN(aprBps.toString()),
      new anchor.BN(faucetCap.toString()),
      new anchor.BN(powReward.toString()),
      powDifficulty,
      oracleAuthority
    )
    .accounts({
      admin: provider.wallet.publicKey,
      mint: rewardMint,
      state: statePda,
      mintAuth: mintAuthPda,
      vault: vaultPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  console.log("Initialization transaction:", txSig);
}

main()
  .then(() => {
    console.log("SkillStake state initialized on devnet.");
  })
  .catch((err) => {
    console.error("Initialization failed:", err);
    process.exitCode = 1;
  });
