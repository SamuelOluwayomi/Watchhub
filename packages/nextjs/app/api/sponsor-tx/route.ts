import { NextResponse } from "next/server";
import { Wallet, JsonRpcProvider } from "ethers";

const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
const MONAD_TESTNET_ID = 10143;
const SPONSOR_PASSWORD = "12345"; // TODO: Move to secure secret management

type SponsoredTransactionRequest = {
  to: string;
  data: string;
  value?: string;
  chainId?: number;
};

/**
 * POST /api/sponsor-tx
 * Handles sponsored transactions using the app's sponsor wallet
 * The sponsor wallet pays for gas, but user address is preserved in the transaction data
 */
export async function POST(request: Request) {
  try {
    const body: SponsoredTransactionRequest = await request.json();

    // Validate request
    if (!body.to || !body.data) {
      return NextResponse.json(
        { error: "Missing required fields: to, data" },
        { status: 400 },
      );
    }

    // Ensure we're on Monad Testnet
    const chainId = body.chainId || MONAD_TESTNET_ID;
    if (chainId !== MONAD_TESTNET_ID) {
      return NextResponse.json(
        { error: `Only Monad Testnet (chain ${MONAD_TESTNET_ID}) is supported` },
        { status: 400 },
      );
    }

    // Get encrypted key from environment
    const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
    if (!encryptedKey) {
      console.error("[Sponsor TX] Missing DEPLOYER_PRIVATE_KEY_ENCRYPTED");
      return NextResponse.json(
        { error: "Sponsor wallet not configured" },
        { status: 500 },
      );
    }

    // Decrypt sponsor wallet
    let sponsorWallet: Awaited<ReturnType<typeof Wallet.fromEncryptedJson>>;
    try {
      sponsorWallet = await Wallet.fromEncryptedJson(encryptedKey, SPONSOR_PASSWORD);
      console.log(`[Sponsor TX] Sponsor wallet ready: ${sponsorWallet.address}`);
    } catch (decryptError) {
      console.error("[Sponsor TX] Failed to decrypt wallet:", decryptError);
      return NextResponse.json(
        { error: "Failed to access sponsor wallet" },
        { status: 500 },
      );
    }

    // Connect to Monad Testnet
    const provider = new JsonRpcProvider(MONAD_TESTNET_RPC, {
      chainId: MONAD_TESTNET_ID,
      name: "monad-testnet",
    });
    const signer = sponsorWallet.connect(provider);

    // Prepare and send transaction
    const tx = {
      to: body.to,
      data: body.data,
      value: body.value || "0",
      gasLimit: "500000", // Increase if needed for complex operations
    };

    console.log(`[Sponsor TX] Sending from ${signer.address} to ${body.to}`);

    const transactionResponse = await signer.sendTransaction(tx);
    const transactionHash = transactionResponse.hash;

    console.log(`[Sponsor TX] Hash: ${transactionHash}`);

    // Wait for receipt
    const receipt = await transactionResponse.wait();

    if (!receipt || receipt.status === 0) {
      return NextResponse.json(
        { error: "Transaction reverted", hash: transactionHash },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      hash: transactionHash,
      receipt: {
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed?.toString(),
        status: receipt.status,
      },
    });
  } catch (error) {
    console.error("[Sponsor TX Error]", error);
    const message = error instanceof Error ? error.message : "Unknown error processing sponsored transaction";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

