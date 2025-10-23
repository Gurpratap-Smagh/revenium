import "dotenv/config";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  AuthorityType,
  setAuthority,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

const PROGRAM_ID_ENV = process.env.PROGRAM_ID;
const REWARD_MINT_ENV = process.env.REWARD_MINT;

async function main() {
  if (!PROGRAM_ID_ENV) {
    throw new Error("PROGRAM_ID env var is required");
  }
  if (!REWARD_MINT_ENV) {
    throw new Error("REWARD_MINT env var is required");
  }

  const programId = new PublicKey(PROGRAM_ID_ENV);
  const mint = new PublicKey(REWARD_MINT_ENV);
  const [mintAuthPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_auth")],
    programId
  );

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const payerWallet = provider.wallet as anchor.Wallet & {
    payer: anchor.web3.Keypair;
  };

  console.log("Setting mint authority to PDA:", mintAuthPda.toBase58());
  const signature = await setAuthority(
    provider.connection,
    payerWallet.payer,
    mint,
    payerWallet.publicKey,
    AuthorityType.MintTokens,
    mintAuthPda,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("Authority updated. Tx signature:", signature);
}

main().catch((err) => {
  console.error("Failed to set mint authority:", err);
  process.exitCode = 1;
});
