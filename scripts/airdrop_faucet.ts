import "dotenv/config";
import * as anchor from "@coral-xyz/anchor";
import {
  getAccount,
  getMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

const PROGRAM_ID_ENV = process.env.PROGRAM_ID;
const REWARD_MINT_ENV = process.env.REWARD_MINT;
const RAW_AMOUNT_ENV = process.env.FAUCET_TOKENS ?? "100";
const WALLET_ENV = process.env.FAUCET_FOR;

function parseAmount(amount: string, decimals: number): anchor.BN {
  const [whole, fraction = ""] = amount.split(".");
  const sanitizedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  const combined = `${whole}${sanitizedFraction}`;
  const raw = combined.replace(/^0+/, "") || "0";
  return new anchor.BN(raw);
}

async function ensureAta(
  provider: anchor.AnchorProvider,
  owner: PublicKey,
  mint: PublicKey
) {
  const ata = getAssociatedTokenAddressSync(mint, owner, false);
  try {
    await getAccount(provider.connection, ata);
    return ata;
  } catch {
    const ix = createAssociatedTokenAccountIdempotentInstruction(
      provider.wallet.publicKey,
      ata,
      owner,
      mint
    );
    const tx = new Transaction().add(ix);
    tx.feePayer = provider.wallet.publicKey;
    tx.recentBlockhash = (
      await provider.connection.getLatestBlockhash("confirmed")
    ).blockhash;
    const signed = await provider.wallet.signTransaction(tx);
    const sig = await provider.connection.sendRawTransaction(
      signed.serialize()
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
    return ata;
  }
}

async function main() {
  if (!PROGRAM_ID_ENV) {
    throw new Error("PROGRAM_ID env var is required");
  }
  if (!REWARD_MINT_ENV) {
    throw new Error("REWARD_MINT env var is required");
  }

  const programId = new PublicKey(PROGRAM_ID_ENV);
  const rewardMint = new PublicKey(REWARD_MINT_ENV);

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = await anchor.Program.fetchIdl(programId, provider);
  if (!idl) {
    throw new Error(`Unable to fetch IDL for program ${programId.toBase58()}`);
  }

  const targetWallet = WALLET_ENV
    ? new PublicKey(WALLET_ENV)
    : provider.wallet.publicKey;

  const program = new anchor.Program(idl, programId, provider);

  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    programId
  );
  const [mintAuthPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_auth")],
    programId
  );

  const mintInfo = await getMint(provider.connection, rewardMint);
  const amountRaw = parseAmount(RAW_AMOUNT_ENV, mintInfo.decimals);

  const userTokenAccount = await ensureAta(provider, targetWallet, rewardMint);

  console.log("Requesting faucet with params:", {
    target: targetWallet.toBase58(),
    amount: RAW_AMOUNT_ENV,
    mintDecimals: mintInfo.decimals,
    userToken: userTokenAccount.toBase58(),
  });

  const signature = await program.methods
    .faucet(amountRaw)
    .accounts({
      admin: provider.wallet.publicKey,
      state: statePda,
      mint: rewardMint,
      mintAuth: mintAuthPda,
      userToken: userTokenAccount,
      user: targetWallet,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log("Faucet transaction signature:", signature);
}

main().catch((err) => {
  console.error("Faucet script failed:", err);
  process.exitCode = 1;
});
