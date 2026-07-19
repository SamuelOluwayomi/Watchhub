/**
 * Gets the encrypted deployer private key from environment (server-side only)
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
 * Sponsor wallet address - public and safe to expose
 */
export const SPONSOR_WALLET_ADDRESS = "0x23ab520f45183bc5c05641aa34c9bff005d27c99";

/**
 * Validates an address format
 * @param address - Address to validate
 * @returns true if valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
