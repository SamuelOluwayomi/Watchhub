import { NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, Contract, AbiCoder } from "ethers";
import { getEncryptedDeployerKey, createSponsorWallet } from "~~/utils/sponsor-wallet";

const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
const MONAD_TESTNET_ID = 10143;

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

    // Initialize sponsor wallet
    const encryptedKey = getEncryptedDeployerKey();
    const password = "12345"; // TODO: Move to secure secret management
    const sponsorWallet = await createSponsorWallet(encryptedKey, password);

    // Connect to Monad Testnet
    const provider = new JsonRpcProvider(MONAD_TESTNET_RPC, {
      chainId: MONAD_TESTNET_ID,
      name: "monad-testnet",
    });
    const signer = new Wallet(sponsorWallet.privateKey, provider);

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

    // Optional: Wait for receipt (can be async later)
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
        transactionHash: receipt.transactionHash,
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
