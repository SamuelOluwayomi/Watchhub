# WatchHub — Tamper-Resistant Movie & Series Ratings on Monad

> Built for the **Spark Hackathon** (BuildAnything · Monad track) · Deadline: Jul 19 2026

WatchHub is a movie and series discovery app that solves a real problem: **online ratings are easy to game** — bot-farmed scores, review-bombing, opaque aggregator weighting. WatchHub aggregates real data from TMDB and adds a **tangper-resistant, onchain community rating system** where each wallet can only ever count once per title, no matter how many times someone tries to re-vote.

---

## Features

### Onchain (Monad Testnet)
| Feature | Contract Function | Details |
|---|---|---|
| Community Rating (1-5 stars) | `rateMovie(movieId, score)` | One active rating per wallet per title — re-voting updates, never inflates |
| Community Rating (Sponsored) | `rateMovieSponsored(movieId, score, user)` | **Gas-free** — sponsor wallet pays gas while preserving user identity |
| Onchain average | `getAverageRating(movieId)` | Returns score x 100 (e.g. `425` = 4.25 stars), no floats in Solidity |
| Full stats | `getMovieStats(movieId)` | Returns total score, vote count, and average in one call |
| Personal collection | `addToCollection(movieId)` / `addToCollectionSponsored(movieId, user)` | Saves a title to your wallet's collection (gas-free option available) |
| Collection removal | `removeFromCollection(movieId)` / `removeFromCollectionSponsored(movieId, user)` | Remove from collection (gas-free option available) |
| Watched tracking | `markAsWatched(movieId, bool)` / `markAsWatchedSponsored(movieId, bool, user)` | Toggle watched/unwatched (gas-free option available) |
| Lookup helpers | `hasUserRated`, `getUserRating`, `isInCollection`, `isWatched` | Per-wallet state checks for UI toggles |
| Discovery | `getRatedMovieIds()`, `getRatedMovieCount()` | Frontend discovers which movies have community votes for the "Top Rated" list |

**Contract:** `WatchHubRating.sol` — deployed on **Monad Testnet** (chain id `10143`)  
**Contract address:** `0xf4EC4D3f933645953eB62B8800ca3606573B0A31` *(redeploy after changes)*

> **TV vs Movie IDs:** TMDB uses separate numbering spaces for movies and TV. The frontend offsets TV series IDs by `+1_000_000_000` before passing them to the contract to avoid collisions.

### Gas Sponsorship
- **Zero gas fees for users** — app's sponsor wallet covers gas for rating, collection, and watched operations
- **Decentralized identity** — user address is preserved in the contract call, even though sponsor wallet pays
- **Server-side relay** — `/api/sponsor-tx` endpoint uses sponsor wallet to send transactions
- **Automatic decryption** — sponsor wallet (`0x23ab520f45183bc5c05641aa34c9bff005d27c99`) is decrypted from encrypted keystore on app startup

### TMDB Data Layer
- Popular and trending movies & series (`/movie/popular`, `/trending/movie/week`, `/tv/popular`, `/trending/tv/week`)
- Genre tagging (`/genre/movie/list`, `/genre/tv/list`)
- Title details — synopsis, poster, backdrop, release year, runtime/seasons
- Cast & crew
- Critic/audience reviews (off-chain display only)
- API key stored server-side as `TMDB_API_KEY` in `packages/nextjs/.env.local`; calls proxied through a Next.js API route so the key is never exposed client-side

### Frontend
- **Explore / Home** — trending TMDB titles with onchain community scores side-by-side
- **Separated Ratings panel** — TMDB score (out of 10) vs. WatchHub community score (out of 5, onchain), clearly labelled with source badges and empty states when no votes exist yet
- **Separated Reviews panel** — TMDB critic reviews vs. community reviews (wallet-gated, coming soon)
- **5-star rating picker** — hover-to-preview, click to submit; no auto-select; shows selected score
- **Card rating popover** — always-visible "Rate" pill on each movie card; click opens a star popover
- **My Collection & Watched** — onchain state per wallet
- **Dark / Light mode** — auto-detects system preference, user can override with light/dark toggle
- **Mobile-first layout** — fixed bottom nav bar on mobile, sticky full-height sidebar on desktop
- **Skeleton loaders** — animated placeholders during TMDB fetch
- **AI mood picks** *(planned)* — natural language → LLM → filtered TMDB recommendation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Chain | Monad Testnet (EVM-compatible, chain id 10143) |
| Smart Contracts | Solidity ^0.8.19 · Hardhat |
| Scaffold | scaffold-monad-hardhat (Scaffold-ETH 2 adapted for Monad) |
| Frontend | Next.js (App Router) · TypeScript |
| Web3 | Wagmi · Viem · RainbowKit |
| Gas Sponsorship | ethers.js (Keystore v3 decryption) · Server-side tx relay |
| Movie Data | TMDB API (server-proxied) |
| Styling | Tailwind CSS v4 · DaisyUI |
| Comments *(planned)* | Supabase (wallet-gated, off-chain) |

---

## Quickstart

### Prerequisites
- [Node.js >= 20.18.3](https://nodejs.org/en/download/)
- [Yarn v1 or v2+](https://yarnpkg.com/getting-started/install)
- [Git](https://git-scm.com/downloads)
- A MetaMask (or compatible) wallet with Monad Testnet configured

### 1. Install dependencies

```bash
yarn install
```

### 2. Configure environment variables

**For the Next.js frontend, create `packages/nextjs/.env.local`:**

```env
# TMDB API (required for movie data)
TMDB_API_KEY=your_tmdb_api_key_here
TMDB_API_READ_ACCESS_TOKEN=optional_bearer_token

# Wallet & Chain (optional, defaults provided)
NEXT_PUBLIC_ALCHEMY_API_KEY=optional_alchemy_key
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=optional_walletconnect_id
```

Get a free TMDB API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).

**For the Hardhat contract layer, `packages/hardhat/.env` is pre-configured** with the sponsor wallet's encrypted private key. To redeploy the contract:

```env
DEPLOYER_PRIVATE_KEY_ENCRYPTED=[encrypted keystore JSON]
ALCHEMY_API_KEY=optional_key_for_rpc
```

The sponsor wallet address (`0x23ab520f45183bc5c05641aa34c9bff005d27c99`) is automatically decrypted with password `12345` on app startup.

### 3. Start the frontend

```bash
yarn start
```

Visit `http://localhost:3000`.

### 4. (Optional) Deploy the contract to Monad Testnet

```bash
yarn deploy --network monadTestnet
```

Update the contract address in `packages/nextjs/contracts/deployedContracts.ts` if you redeploy.

---

## Project Structure

```
moviehub/
├── packages/
│   ├── hardhat/
│   │   ├── contracts/
│   │   │   └── WatchHubRating.sol      # Core onchain rating + collection + watched contract
│   │   ├── deploy/                     # Hardhat deploy scripts
│   │   ├── .env                        # Encrypted sponsor wallet private key
│   │   └── hardhat.config.ts           # Monad Testnet + Sourcify config
│   └── nextjs/
│       ├── app/
│       │   ├── page.tsx                # Main WatchHub UI (home / explore)
│       │   ├── layout.tsx              # App layout + providers
│       │   └── api/
│       │       ├── sponsor-tx/         # Server-side gas sponsorship relay
│       │       ├── reviews/            # User review storage
│       │       └── tmdb/
│       │           ├── details/        # TMDB title details proxy
│       │           └── watchhub/       # Server-side TMDB data aggregation
│       ├── components/
│       │   ├── SwitchTheme.tsx         # Light/dark mode toggle
│       │   ├── ScaffoldEthAppWithProviders.tsx  # App providers + SponsorWalletProvider
│       │   └── scaffold-eth/           # RainbowKit connect button + scaffold hooks
│       ├── contexts/
│       │   └── SponsorWalletContext.tsx # Gas sponsorship wallet context
│       ├── hooks/scaffold-eth/
│       │   ├── useSponsorWrite.ts      # Hook for gas-sponsored contract writes
│       │   └── [other scaffold hooks]  # useScaffoldReadContract, etc.
│       ├── utils/
│       │   ├── sponsor-wallet.ts       # Sponsor wallet decryption utilities
│       │   └── [other utilities]
│       ├── styles/globals.css          # Tailwind v4 + DaisyUI theme tokens
│       └── scaffold.config.ts          # Target network = Monad Testnet
```

---

## Smart Contract — `WatchHubRating.sol`

### Ratings
```solidity
function rateMovie(uint256 movieId, uint8 score) external;                    // 1-5, one per wallet
function rateMovieSponsored(uint256 movieId, uint8 score, address user) external;  // Gas-free (sponsor pays)
function getAverageRating(uint256 movieId) external view returns (uint256);   // x 100
function getMovieStats(uint256 movieId) external view returns (uint256 totalScore, uint256 count, uint256 average);
function hasUserRated(address user, uint256 movieId) external view returns (bool);
function getUserRating(address user, uint256 movieId) external view returns (uint8);
function getRatedMovieIds() external view returns (uint256[] memory);
```

### Collection
```solidity
function addToCollection(uint256 movieId) external;
function addToCollectionSponsored(uint256 movieId, address user) external;    // Gas-free (sponsor pays)
function removeFromCollection(uint256 movieId) external;
function removeFromCollectionSponsored(uint256 movieId, address user) external;  // Gas-free (sponsor pays)
function isInCollection(address user, uint256 movieId) external view returns (bool);
function getUserCollection(address user) external view returns (uint256[] memory);
```

### Watched
```solidity
function markAsWatched(uint256 movieId, bool watched) external;
function markAsWatchedSponsored(uint256 movieId, bool watched, address user) external;  // Gas-free (sponsor pays)
function isWatched(address user, uint256 movieId) external view returns (bool);
```

### Events
```solidity
event MovieRated(address indexed user, uint256 indexed movieId, uint8 score);
event AddedToCollection(address indexed user, uint256 indexed movieId);
event RemovedFromCollection(address indexed user, uint256 indexed movieId);
event WatchedStatusUpdated(address indexed user, uint256 indexed movieId, bool watched);
```

---

## Contract Verification (Monad Testnet)

```bash
yarn deploy --network monadTestnet
yarn hardhat-verify --network monadTestnet <CONTRACT_ADDRESS>
```

Sourcify is configured in `packages/hardhat/hardhat.config.ts`:

```typescript
sourcify: {
  enabled: true,
  apiUrl: "https://sourcify-api-monad.blockvision.org",
  browserUrl: "https://testnet.monadexplorer.com",
},
```

---

## Gas Sponsorship Setup

WatchHub uses **gas-free transactions** for users by relaying all writes through a sponsor wallet.

### How It Works

1. **User connects wallet** → MetaMask/Rainbow Kit (standard Web3 flow)
2. **User rates/bookmarks/marks watched** → Frontend calls `useSponsorWrite()` hook
3. **Hook encodes call** → Buildsa contract function call with user's address as parameter
4. **Server-side relay** → `/api/sponsor-tx` endpoint receives the encoded call
5. **Sponsor wallet sends tx** → Server decrypts sponsor wallet from `DEPLOYER_PRIVATE_KEY_ENCRYPTED`, signs & sends on Monad
6. **User address preserved** → Sponsor functions (`rateMovieSponsored`, `addToCollectionSponsored`, etc.) record the *user's* address, not sponsor's

### Environment Setup for Deployment

**The sponsor wallet is pre-configured**, but you can verify/update it:

1. **Check `packages/hardhat/.env`:**
   ```
   DEPLOYER_PRIVATE_KEY_ENCRYPTED=[encrypted keystore]
   ```

2. **Verify sponsor has MON tokens** for gas:
   ```bash
   # Sponsor wallet address:
   0x23ab520f45183bc5c05641aa34c9bff005d27c99
   ```
   Get MON from the faucet: https://testnet-faucet.monad.xyz

3. **Decryption happens automatically** via `SponsorWalletContext`:
   - Password: `12345` (hardcoded for hackathon; move to secure secret manager for production)
   - Wallet decrypts on app startup
   - Available to `/api/sponsor-tx` for relay

### For Production

Before deploying to mainnet/production:
- Move sponsor wallet password to environment variables or AWS Secrets Manager
- Add signature verification to prevent unauthorized relay calls
- Implement rate limiting on `/api/sponsor-tx`
- Consider a separate "paymaster" or "relayer" service
- Audit the sponsor wallet security model

---

## Why Onchain Ratings?

Traditional review aggregators (IMDb, Rotten Tomatoes) have no cryptographic guarantee that a score wasn't gamed. A single actor or studio can:
- Create thousands of bot accounts to rate-bomb a competitor
- Coordinate mass 1-star reviews on opening weekend

WatchHub's smart contract enforces **one active rating per wallet per title**. A wallet can update its rating, but updating only replaces its existing vote in the running total — it never adds a second vote. The Monad chain provides the neutral, tamper-evident ledger that no centralized database can match.

---

## Hackathon Submission Info

| Field | Value |
|---|---|
| Event | Spark (buildanything.so/hackathons/spark) |
| Track | Monad — BuildAnything |
| Category | Monad Testnet |
| Contract | `WatchHubRating.sol` on Monad Testnet |
| Problem | Review manipulation + decision fatigue when choosing what to watch |
| Solution | TMDB data aggregation + onchain 1-wallet-1-vote community ratings |

**Submission framing:**  
*"I always struggle to decide what to watch — checking reviews is exhausting and I don't fully trust them because ratings can be manipulated. WatchHub aggregates real movie/series data with an onchain community rating that can't be gamed by one person voting a hundred times, plus a personal watchlist so I don't lose track of what I actually want to see."*

---

## License

MIT