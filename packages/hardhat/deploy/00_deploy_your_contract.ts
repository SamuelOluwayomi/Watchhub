import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the WatchHubRating contract using the deployer account.
 * No constructor arguments are needed — the contract is fully permissionless.
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployWatchHubRating: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network monadTestnet`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn account:generate` or import your
    existing PK which will fill DEPLOYER_PRIVATE_KEY_ENCRYPTED in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("WatchHubRating", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const watchHubRating = await hre.ethers.getContract<Contract>("WatchHubRating", deployer);
  console.log("🎬 WatchHubRating deployed at:", await watchHubRating.getAddress());
};

export default deployWatchHubRating;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags WatchHubRating
deployWatchHubRating.tags = ["WatchHubRating"];
