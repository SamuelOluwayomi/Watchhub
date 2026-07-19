import { Wallet } from "ethers";

/**
 * Decrypts the sponsor wallet private key from encrypted keystore
 * @param encryptedJson - The encrypted keystore JSON string (from .env)
 * @param password - The password to decrypt
 * @returns The sponsor wallet instance
 */
export async function createSponsorWallet(
  encryptedJson: string,
  password: string,
): Promise<Wallet> {
  try {
    const wallet = await Wallet.fromEncryptedJson(encryptedJson, password);
    console.log("✓ Sponsor wallet decrypted successfully");
    console.log(`  Address: ${wallet.address}`);
    return wallet;
  } catch (error) {
    throw new Error(
      `Failed to decrypt sponsor wallet: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Gets the encrypted deployer private key from environment
 * @returns The encrypted keystore JSON string
 */
export function getEncryptedDeployerKey(): string {
  const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
  if (!encryptedKey) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY_ENCRYPTED not found in packages/hardhat/.env. Please check your environment configuration.",
    );
  }
  return encryptedKey;
}

/**
 * Validates that the sponsor wallet has the expected address
 * @param wallet - The wallet to validate
 * @param expectedAddress - The expected address (from encrypted key metadata)
 * @returns true if addresses match
 */
export function validateSponsorWallet(wallet: Wallet, expectedAddress?: string): boolean {
  if (expectedAddress && wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    console.warn(
      `⚠ Sponsor wallet address mismatch: ${wallet.address} != ${expectedAddress}`,
    );
    return false;
  }
  return true;
}
