import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { encodeFunctionData } from "viem";
import { deployedContracts } from "~~/contracts/deployedContracts";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth/useDeployedContractInfo";
import { useSelectedNetwork } from "~~/hooks/scaffold-eth/useSelectedNetwork";
import { notification } from "~~/utils/scaffold-eth";

const SPONSOR_TX_ENDPOINT = "/api/sponsor-tx";

type SponsoredWriteOptions = {
  functionName: string;
  args: any[];
  onSuccess?: (hash: string) => void;
  onError?: (error: Error) => void;
};

/**
 * Hook to execute sponsored contract writes
 * Sends transactions through the sponsor wallet API endpoint
 * while preserving the connected user's address
 */
export const useSponsorWrite = () => {
  const { address: userAddress } = useAccount();
  const { data: contractInfo } = useDeployedContractInfo("WatchHubRating");
  const selectedNetwork = useSelectedNetwork();
  const [isLoading, setIsLoading] = useState(false);

  const sponsorWrite = useCallback(
    async (options: SponsoredWriteOptions) => {
      if (!userAddress) {
        notification.error("Please connect your wallet");
        return;
      }

      if (!contractInfo?.address) {
        notification.error("Contract not found");
        return;
      }

      setIsLoading(true);
      let notificationId: string | null = null;

      try {
        // Get the contract ABI
        const abi = contractInfo.abi;

        // Build the function arguments including user address for sponsored calls
        let callArgs = options.args;
        if (
          options.functionName.endsWith("Sponsored") ||
          options.functionName === "rateMovieSponsored" ||
          options.functionName === "addToCollectionSponsored" ||
          options.functionName === "removeFromCollectionSponsored" ||
          options.functionName === "markAsWatchedSponsored"
        ) {
          // For sponsored functions, add user address as last parameter
          callArgs = [...options.args, userAddress];
        }

        // Encode the function call using viem
        const data = encodeFunctionData({
          abi,
          functionName: options.functionName,
          args: callArgs,
        });

        notificationId = notification.loading("Sending sponsored transaction...");

        // Call the sponsor API endpoint
        const response = await fetch(SPONSOR_TX_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: contractInfo.address,
            data: data,
            value: "0",
            chainId: selectedNetwork.id,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Sponsored transaction failed");
        }

        const result = await response.json();
        notification.remove(notificationId);

        if (result.success) {
          notification.success(
            `Transaction sent! Hash: ${result.hash.slice(0, 10)}...`,
          );
          options.onSuccess?.(result.hash);
          return result.hash;
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        if (notificationId) {
          notification.remove(notificationId);
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        notification.error(message);
        options.onError?.(error instanceof Error ? error : new Error(message));
      } finally {
        setIsLoading(false);
      }
    },
    [userAddress, contractInfo?.address, contractInfo?.abi, selectedNetwork],
  );

  return { sponsorWrite, isLoading };
};
