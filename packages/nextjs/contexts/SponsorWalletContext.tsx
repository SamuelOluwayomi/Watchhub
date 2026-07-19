"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { SPONSOR_WALLET_ADDRESS } from "~~/utils/sponsor-wallet";

type SponsorWalletContextType = {
  isReady: boolean;
  isAvailable: boolean;
  address: string;
  error: string | null;
};

const SponsorWalletContext = createContext<SponsorWalletContextType | undefined>(undefined);

export const SponsorWalletProvider = ({ children }: { children: ReactNode }) => {
  const [isReady, setIsReady] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSponsorAvailability = async () => {
      try {
        // Test if the sponsor tx endpoint is available
        const response = await fetch("/api/sponsor-tx", {
          method: "OPTIONS",
        }).catch(() => null);

        // If we get any response (or a CORS error), the endpoint exists
        const available = response !== null;
        setIsAvailable(available);

        if (available) {
          console.log("✓ Gas sponsor system ready");
          console.log(`  Sponsor wallet: ${SPONSOR_WALLET_ADDRESS}`);
        } else {
          console.warn("⚠ Gas sponsor endpoint not available");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error checking sponsor availability";
        console.error("Sponsor availability check:", errorMessage);
        setError(errorMessage);
      } finally {
        setIsReady(true);
      }
    };

    checkSponsorAvailability();
  }, []);

  return (
    <SponsorWalletContext.Provider
      value={{
        isReady,
        isAvailable,
        address: SPONSOR_WALLET_ADDRESS,
        error,
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
