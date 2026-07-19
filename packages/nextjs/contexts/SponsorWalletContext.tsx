"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Wallet } from "ethers";
import { createSponsorWallet, getEncryptedDeployerKey, validateSponsorWallet } from "~~/utils/sponsor-wallet";

type SponsorWalletContextType = {
  wallet: Wallet | null;
  isReady: boolean;
  error: string | null;
  address: string | null;
};

const SponsorWalletContext = createContext<SponsorWalletContextType | undefined>(undefined);

export const SponsorWalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeSponsorWallet = async () => {
      try {
        const encryptedKey = getEncryptedDeployerKey();
        // Use hardcoded password for now - in production, this should come from a secure source
        const password = "12345";
        const sponsorWallet = await createSponsorWallet(encryptedKey, password);
        validateSponsorWallet(sponsorWallet, "23ab520f45183bc5c05641aa34c9bff005d27c99");
        setWallet(sponsorWallet);
        setIsReady(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error initializing sponsor wallet";
        console.error("Sponsor wallet error:", errorMessage);
        setError(errorMessage);
        setIsReady(true); // Mark as ready even on error so app can continue
      }
    };

    initializeSponsorWallet();
  }, []);

  return (
    <SponsorWalletContext.Provider
      value={{
        wallet,
        isReady,
        error,
        address: wallet?.address || null,
      }}
    >
      {children}
    </SponsorWalletContext.Provider>
  );
};

export const useSponsorWallet = () => {
  const context = useContext(SponsorWalletContext);
  if (!context) {
    throw new Error("useSponsorWallet must be used within SponsorWalletProvider");
  }
  return context;
};
