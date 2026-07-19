# WatchHub — Tamper-Resistant Movie & Series Ratings on Monad

> Built for the **Spark Hackathon** (BuildAnything · Monad track) · Deadline: Jul 19 2026

WatchHub is a movie and series discovery app that solves a real problem: **online ratings are easy to game** — bot-farmed scores, review-bombing, opaque aggregator weighting. WatchHub aggregates real data from TMDB and adds a **tangper-resistant, onchain community rating system** where each wallet can only ever count once per title, no matter how many times someone tries to re-vote.

---

## Features

### Onchain (Monad Testnet)
| Feature | Contract Function | Details |
|---|---|---|
| Community Rating (1-5 stars) | `rateMovie(movieId, score)` | One active rating per wallet per title — re-voting updates, never inflates |
| Onchain average | `getAverageRating(movieId)` | Returns score x 100 (e.g. `425` = 4.25 stars), no floats in Solidity |
| Full stats | `getMovieStats(movieId)` | Returns total score, vote count, and average in one call |
| Personal collection | `addToCollection(movieId)` | Saves a title to your wallet's collection |
| Watched tracking | `markAsWatched(movieId, bool)` | Toggle watched/unwatched, stored per wallet |
| Lookup helpers | `hasUserRated`, `getUserRating`, `isInCollection`, `isWatched` | Per-wallet state checks for UI toggles |
| Discovery | `getRatedMovieIds()`, `getRatedMovieCount()` | Frontend discovers which movies have community votes for the "Top Rated" list |

**Contract:** `WatchHubRating.sol` — deployed on **Monad Testnet** (chain id `10143`)  
**Contract address:** `0xf4EC4D3f933645953eB62B8800ca3606573B0A31` *(redeploy after changes)*

> **TV vs Movie IDs:** TMDB uses separate numbering spaces for movies and TV. The frontend offsets TV series IDs by `+1_000_000_000` before passing them to the contract to avoid collisions.

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

Create `packages/nextjs/.env.local`:

```env
TMDB_API_KEY=your_tmdb_api_key_here
NEXT_PUBLIC_ALCHEMY_API_KEY=optional_alchemy_key
```

Get a free TMDB API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).

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
│   │   └── hardhat.config.ts           # Monad Testnet + Sourcify config
│   └── nextjs/
│       ├── app/
│       │   ├── page.tsx                # Main WatchHub UI (home / explore)
│       │   ├── layout.tsx              # App layout + providers
│       │   └── api/
│       │       └── tmdb/
│       │           └── watchhub/       # Server-side TMDB proxy route
│       ├── components/
│       │   ├── SwitchTheme.tsx         # Light/dark mode toggle
│       │   └── scaffold-eth/           # RainbowKit connect button + scaffold hooks
│       ├── hooks/scaffold-eth/         # useScaffoldReadContract / useScaffoldWriteContract
│       ├── styles/globals.css          # Tailwind v4 + DaisyUI theme tokens
│       └── scaffold.config.ts          # Target network = Monad Testnet
```

---

## Smart Contract — `WatchHubRating.sol`

### Ratings
```solidity
function rateMovie(uint256 movieId, uint8 score) external;           // 1-5, one per wallet
function getAverageRating(uint256 movieId) external view returns (uint256); // x 100
function getMovieStats(uint256 movieId) external view returns (uint256 totalScore, uint256 count, uint256 average);
function hasUserRated(address user, uint256 movieId) external view returns (bool);
function getUserRating(address user, uint256 movieId) external view returns (uint8);
function getRatedMovieIds() external view returns (uint256[] memory);
```

### Collection
```solidity
function addToCollection(uint256 movieId) external;
function isInCollection(address user, uint256 movieId) external view returns (bool);
function getUserCollection(address user) external view returns (uint256[] memory);
```

### Watched
```solidity
function markAsWatched(uint256 movieId, bool watched) external;
function isWatched(address user, uint256 movieId) external view returns (bool);
```

### Events
```solidity
event MovieRated(address indexed user, uint256 indexed movieId, uint8 score);
event AddedToCollection(address indexed user, uint256 indexed movieId);
event WatchedStatusUpdated(address indexed user, indexed movieId, bool watched);
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