"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { NextPage } from "next";
import { useTheme } from "next-themes";
import { useAccount } from "wagmi";
import {
  BellIcon,
  BookmarkIcon,
  BugAntIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  FilmIcon,
  FireIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PlayIcon,
  SparklesIcon,
  StarIcon,
  SunIcon,
  TvIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const MONAD_TESTNET_ID = 10143;

type WatchHubItem = {
  tmdbId: number;
  contractId: string;
  mediaType: "movie" | "tv";
  typeLabel: string;
  title: string;
  overview: string;
  year: string;
  genres: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  tmdbRating: number;
  tmdbVoteCount: number;
};

type WatchHubFeatured = WatchHubItem & {
  runtime: string | null;
  cast: {
    id: number;
    name: string;
    character: string;
    profileUrl: string | null;
  }[];
  reviews: {
    id: string;
    author: string;
    content: string;
  }[];
};

type WatchHubData = {
  featured: WatchHubFeatured;
  recommendations: WatchHubItem[];
  continueWatching: WatchHubItem[];
  categories: string[];
  attribution: string;
};

type CommunityReview = {
  id: string;
  movie_id: string;
  wallet_address: string;
  content: string;
  movie_title: string;
  created_at: string;
};

const formatScore = (averageScaled?: bigint) => {
  if (!averageScaled) return "New";
  return (Number(averageScaled) / 100).toFixed(2);
};

const MediaImage = ({ src, alt, className }: { src: string | null; alt: string; className: string }) => {
  if (!src) {
    return (
      <div className={`${className} grid place-items-center bg-base-300 text-neutral/45`}>
        <FilmIcon className="size-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image src={src} alt={alt} width={1280} height={720} sizes="(max-width: 768px) 100vw, 50vw" className={className} />
  );
};

/* ─────────────── Skeleton ─────────────── */
const SkeletonPulse = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-2xl bg-base-300 ${className}`} />
);

const DashboardSkeleton = () => (
  <div className="flex min-h-screen bg-base-200">
    {/* Sidebar skeleton */}
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-base-300 bg-base-100 p-5">
      <SkeletonPulse className="mb-8 h-10 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonPulse key={i} className="h-11 w-full rounded-full" />
        ))}
      </div>
      <div className="mt-9 space-y-4">
        <SkeletonPulse className="h-5 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonPulse key={i} className="h-12 w-full" />
        ))}
      </div>
    </aside>

    {/* Content skeleton */}
    <div className="flex-1 min-w-0 p-4 sm:p-6 space-y-5">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <SkeletonPulse className="h-11 w-60 rounded-full" />
        <SkeletonPulse className="h-11 flex-1 rounded-full" />
        <SkeletonPulse className="h-11 w-24 rounded-full" />
      </div>
      {/* Hero */}
      <SkeletonPulse className="h-[380px] sm:h-[440px] w-full rounded-3xl" />
      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonPulse key={i} className="aspect-[1.42] rounded-2xl" />
        ))}
      </div>
    </div>
  </div>
);

/* ─────────────── Theme Toggle ─────────────── */
const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="size-11 rounded-full bg-base-200" />;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-base-300 bg-base-100 text-neutral transition hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {isDark ? <SunIcon className="size-5" aria-hidden="true" /> : <MoonIcon className="size-5" aria-hidden="true" />}
    </button>
  );
};

/* ─────────────── Star Rating Picker (inline hero) ─────────────── */
const StarRatingPicker = ({
  onRate,
  disabled,
}: {
  onRate: (score: number) => void;
  disabled: boolean;
}) => {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  const handleSelect = (score: number) => {
    setSelected(score);
    onRate(score);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-white/70 uppercase tracking-wider">Your rating</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            disabled={disabled}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => handleSelect(star)}
            className="p-1 transition-transform hover:scale-125 will-change-transform disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none"
          >
            <StarIcon
              className={`size-7 transition-colors ${
                star <= (hovered || selected)
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-white/20 text-white/40"
              }`}
              aria-hidden="true"
            />
          </button>
        ))}
        {selected > 0 && (
          <span className="ml-2 text-sm font-black text-yellow-400">{selected}/5</span>
        )}
      </div>
    </div>
  );
};

/* ─────────────── Card Rating Button + Popover ─────────────── */
const CardRatingButton = ({
  title,
  contractId,
  onRate,
  disabled,
}: {
  title: string;
  contractId: string;
  onRate: (contractId: string, score: number) => void;
  disabled: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  const handleSelect = (score: number) => {
    setSelected(score);
    onRate(contractId, score);
    setTimeout(() => setOpen(false), 600);
  };

  return (
    <div className="relative shrink-0">
      {/* Always-visible Rate button */}
      <button
        aria-label={`Rate ${title}`}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <StarIcon className="size-3.5" aria-hidden="true" />
        {selected > 0 ? `${selected}★` : "Rate"}
      </button>

      {/* Popover star picker */}
      {open && (
        <>
          {/* Click-away backdrop */}
          <div
            className="fixed inset-0 z-30"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label={`Rate ${title}`}
            className="absolute bottom-full right-0 z-40 mb-2 flex flex-col gap-2 rounded-2xl bg-neutral/95 px-4 py-3 shadow-xl backdrop-blur"
          >
            <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-white/60">Pick a rating</p>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  disabled={disabled}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => handleSelect(star)}
                  className="p-1 transition-transform hover:scale-125 will-change-transform disabled:cursor-not-allowed focus-visible:outline-none"
                >
                  <StarIcon
                    className={`size-6 transition-colors ${
                      star <= (hovered || selected)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-white/20 text-white/50"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ─────────────── Main Page ─────────────── */
const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [data, setData] = useState<WatchHubData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(0);

  // Onchain collection / watched local toggle state (optimistic)
  const [inCollection, setInCollection] = useState(false);
  const [isWatchedLocal, setIsWatchedLocal] = useState(false);

  // Community reviews (Supabase)
  const [reviews, setReviews] = useState<CommunityReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const reviewTextRef = useRef<HTMLTextAreaElement>(null);

  const featuredContractId = useMemo(() => BigInt(data?.featured.contractId || "0"), [data?.featured.contractId]);

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "WatchHubRating",
    chainId: MONAD_TESTNET_ID,
  });

  const { data: movieStats } = useScaffoldReadContract({
    contractName: "WatchHubRating",
    functionName: "getMovieStats",
    args: [featuredContractId],
    chainId: MONAD_TESTNET_ID,
    query: { enabled: Boolean(data?.featured) },
  });

  const loadWatchHub = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/tmdb/watchhub");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load WatchHub.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load WatchHub.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadWatchHub(); }, []);

  const fetchReviews = useCallback(async (contractId: string) => {
    setReviewsLoading(true);
    try {
      const res = await fetch(`/api/reviews?movieId=${encodeURIComponent(contractId)}`);
      const payload = await res.json();
      setReviews(payload.reviews || []);
    } catch {
      // non-fatal — just show empty state
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (data?.featured?.contractId) {
      fetchReviews(data.featured.contractId);
      // reset optimistic toggle state when featured title changes
      setInCollection(false);
      setIsWatchedLocal(false);
      setReviewText("");
      setReviewError(null);
      setReviewSuccess(false);
    }
  }, [data?.featured?.contractId, fetchReviews]);

  const writeRating = async (contractId: string, score: number) => {
    await writeContractAsync({ functionName: "rateMovie", args: [BigInt(contractId), score] });
  };
  const addToCollection = async (contractId: string) => {
    try {
      if (inCollection) {
        await writeContractAsync({ functionName: "removeFromCollection", args: [BigInt(contractId)] });
        setInCollection(false);
      } else {
        await writeContractAsync({ functionName: "addToCollection", args: [BigInt(contractId)] });
        setInCollection(true);
      }
    } catch {
      // scaffold-eth shows toast on error
    }
  };
  const markWatched = async (contractId: string) => {
    try {
      await writeContractAsync({ functionName: "markAsWatched", args: [BigInt(contractId), !isWatchedLocal] });
      setIsWatchedLocal(prev => !prev);
    } catch {
      // scaffold-eth shows toast on error
    }
  };

  const submitReview = async () => {
    if (!connectedAddress || !data?.featured || reviewText.trim().length < 10) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId: data.featured.contractId,
          walletAddress: connectedAddress,
          content: reviewText.trim(),
          movieTitle: data.featured.title,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to submit review");
      setReviewText("");
      setReviewSuccess(true);
      setTimeout(() => setReviewSuccess(false), 4000);
      await fetchReviews(data.featured.contractId);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-base-200 p-4 text-base-content">
        <section className="w-full max-w-lg rounded-3xl bg-base-100 p-8 shadow-center">
          <div className="mb-4 grid size-14 place-items-center rounded-full bg-secondary text-primary">
            <FilmIcon className="size-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black text-neutral">Could not load TMDB</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-neutral/65">{error}</p>
          <button
            onClick={loadWatchHub}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-content transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  if (!data || data.recommendations.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-base-200 p-4 text-base-content">
        <section className="w-full max-w-lg rounded-3xl bg-base-100 p-8 text-center shadow-center">
          <FilmIcon className="mx-auto size-12 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black text-neutral">No titles yet</h1>
          <p className="mt-2 text-sm font-semibold text-neutral/65">TMDB responded, but there were no movies or series to show.</p>
        </section>
      </main>
    );
  }

  const { featured } = data;
  const watchHubScore = movieStats ? formatScore(movieStats[2]) : "New";
  const ratingCount = movieStats ? Number(movieStats[1]) : 0;
  const featureMeta = [featured.year, featured.runtime, featured.genres[0], `TMDB ${featured.tmdbRating || "N/A"}`].filter(Boolean);

  const navLinks = [
    { href: "/", label: "Explore", icon: <HomeIcon className="size-5" aria-hidden="true" />, active: true },
    { href: "#top-rated", label: "Top rated", icon: <StarIcon className="size-5" aria-hidden="true" />, active: false },
    { href: "#collection", label: "My Collection", icon: <BookmarkIcon className="size-5" aria-hidden="true" />, active: false },
    { href: "#watched", label: "Watched", icon: <CheckCircleIcon className="size-5" aria-hidden="true" />, active: false },
    { href: "/debug", label: "Debug", icon: <BugAntIcon className="size-5" aria-hidden="true" />, active: false },
  ];

  return (
    <>
      {/* ── Root layout: sidebar + scrollable content ── */}
      <div className="flex min-h-screen bg-base-200">

        {/* ════ SIDEBAR (desktop only) ════ */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-base-100 border-r border-base-300 sticky top-0 h-screen overflow-y-auto">
          <div className="flex flex-col flex-1 p-5">
            {/* Logo */}
            <Link
              href="/"
              className="mb-8 flex min-h-10 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-content">
                <PlayIcon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-primary">WatchHub</span>
                <span className="block text-sm font-semibold text-neutral">Monad ratings</span>
              </span>
            </Link>

            {/* Nav */}
            <nav aria-label="WatchHub sections" className="space-y-1 text-sm font-semibold">
              {navLinks.map(link =>
                link.href.startsWith("/") && !link.href.startsWith("/#") ? (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`flex min-h-11 items-center gap-3 rounded-full px-4 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      link.active
                        ? "bg-primary text-primary-content shadow-sm"
                        : "text-neutral/75 hover:bg-base-200"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    className="flex min-h-11 items-center gap-3 rounded-full px-4 text-neutral/75 transition hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {link.icon}
                    {link.label}
                  </a>
                )
              )}
            </nav>

            {/* Popular series mini-list */}
            <div className="mt-9 flex-1 min-h-0">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-neutral">Popular series</h2>
                <a
                  href="#top-rated"
                  className="rounded-full px-3 py-1 text-xs font-semibold text-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  See all
                </a>
              </div>
              <div className="space-y-3">
                {data.continueWatching.map(item => (
                  <button
                    key={`${item.mediaType}-${item.tmdbId}`}
                    className="grid min-h-12 w-full grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-primary rounded-xl p-1 hover:bg-base-200 transition"
                  >
                    <MediaImage src={item.posterUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-neutral">{item.title}</span>
                      <span className="block text-xs font-medium text-neutral/55">
                        {item.year} {item.genres[0] || item.typeLabel}
                      </span>
                    </span>
                    <span className="grid size-8 place-items-center rounded-full bg-base-200 text-primary">
                      <PlayIcon className="size-4" aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme toggle at bottom of sidebar */}
            <div className="mt-6 flex items-center gap-3 pt-4 border-t border-base-300">
              <ThemeToggle />
              <span className="text-xs font-semibold text-neutral/60">Toggle theme</span>
            </div>
          </div>
        </aside>

        {/* ════ MAIN CONTENT ════ */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex items-center gap-3 bg-base-100/90 backdrop-blur border-b border-base-300 px-4 py-3 sm:px-6">
            {/* Mobile logo */}
            <Link href="/" className="flex items-center gap-2 lg:hidden shrink-0">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-content">
                <PlayIcon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-primary">WatchHub</span>
            </Link>

            {/* Search */}
            <label className="relative flex-1 max-w-sm hidden sm:block">
              <span className="sr-only">Search movies and series</span>
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-neutral/45"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search"
                className="h-11 w-full rounded-full border border-base-300 bg-base-200 pl-12 pr-4 text-sm font-medium text-neutral placeholder:text-neutral/45 focus:border-primary focus:bg-base-100 focus:outline-none focus:ring-2 focus:ring-primary/25 transition"
              />
            </label>

            {/* Search icon only on mobile */}
            <button className="grid size-10 place-items-center rounded-full border border-base-300 bg-base-200 text-neutral sm:hidden">
              <MagnifyingGlassIcon className="size-5" aria-hidden="true" />
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Theme toggle (top bar on mobile, also in sidebar on desktop) */}
            <ThemeToggle />

            {/* Notifications */}
            <button
              aria-label="Notifications"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-base-300 bg-base-100 text-neutral transition hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <BellIcon className="size-5" aria-hidden="true" />
            </button>

            {/* Wallet address pill */}
            <div className="hidden min-w-0 items-center gap-2 rounded-full border border-base-300 bg-base-100 p-1 pr-3 sm:flex">
              <UserCircleIcon className="size-9 text-neutral/70 shrink-0" aria-hidden="true" />
              <span className="max-w-28 truncate text-sm font-bold text-neutral">
                {connectedAddress ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}` : "Connect"}
              </span>
              <ChevronDownIcon className="size-4 shrink-0 text-neutral/45" aria-hidden="true" />
            </div>

            <RainbowKitCustomConnectButton />
          </header>

          {/* Category strip */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-base-300 bg-base-100 px-4 py-3 sm:px-6 scrollbar-none">
            {data.categories.map((category, index) => (
              <button
                key={category}
                onClick={() => setActiveCategory(index)}
                className={`min-h-9 shrink-0 rounded-full px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  activeCategory === index
                    ? "bg-primary text-primary-content shadow-sm"
                    : "bg-base-200 text-neutral/70 hover:bg-base-300"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Scrollable page body */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-24 lg:pb-6">

            {/* ── Hero / Featured ── */}
            <section className="relative isolate overflow-hidden rounded-3xl bg-neutral text-white min-h-[340px] sm:min-h-[420px]">
              {/* Mining indicator overlay */}
              {isMining && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-3xl">
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-10 rounded-full border-4 border-primary border-t-transparent animate-spin will-change-transform" />
                    <p className="text-sm font-bold text-white">Submitting to Monad…</p>
                  </div>
                </div>
              )}
              <MediaImage
                src={featured.backdropUrl || featured.posterUrl}
                alt={`${featured.title} backdrop`}
                className="absolute inset-0 -z-10 h-full w-full object-cover will-change-transform"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/55 to-black/10" />
              <div className="grid content-end p-5 sm:p-8 lg:p-10 min-h-[340px] sm:min-h-[420px]">
                <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-bold text-white backdrop-blur">
                  <FireIcon className="size-5 text-primary" aria-hidden="true" />
                  Trending from TMDB
                </div>
                <div className="max-w-2xl">
                  <h1 className="text-3xl font-black leading-none text-white sm:text-5xl lg:text-6xl">{featured.title}</h1>
                  <p className="mt-3 text-sm font-semibold text-white/80">{featureMeta.join(" • ")} • WatchHub {watchHubScore}</p>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base line-clamp-3 sm:line-clamp-none">
                    {featured.overview}
                  </p>
                </div>
                {/* Inline star rating picker */}
                <StarRatingPicker
                  onRate={(score) => writeRating(featured.contractId, score)}
                  disabled={isMining}
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => addToCollection(featured.contractId)}
                    disabled={isMining || !connectedAddress}
                    title={!connectedAddress ? "Connect wallet to save" : undefined}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60 ${
                      inCollection ? "bg-primary text-white" : "bg-white/14 text-white"
                    }`}
                  >
                    <BookmarkIcon className="size-5" aria-hidden="true" />
                    {inCollection ? "Saved" : "Collection"}
                  </button>
                  <button
                    onClick={() => markWatched(featured.contractId)}
                    disabled={isMining || !connectedAddress}
                    title={!connectedAddress ? "Connect wallet to mark watched" : undefined}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60 ${
                      isWatchedLocal ? "bg-green-500 text-white" : "bg-white/14 text-white"
                    }`}
                  >
                    <CheckCircleIcon className="size-5" aria-hidden="true" />
                    {isWatchedLocal ? "Watched ✓" : "Mark Watched"}
                  </button>
                </div>
              </div>
            </section>

            {/* ══════ RATINGS — TMDB vs Community ══════ */}
            <section id="ratings">
              <h2 className="mb-3 text-xl font-black text-neutral">Ratings</h2>
              <div className="grid gap-4 sm:grid-cols-2">

                {/* ── TMDB Rating ── */}
                <div className="rounded-2xl border border-base-300 bg-base-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-500">
                        <FilmIcon className="size-3.5" aria-hidden="true" />
                        TMDB
                      </span>
                      <p className="mt-2 text-xs font-semibold text-neutral/55">The Movie Database</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-neutral">{featured.tmdbRating || "—"}</p>
                      <p className="text-xs font-semibold text-neutral/55">out of 10</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-3">
                    {[1,2,3,4,5].map(s => (
                      <StarIcon
                        key={s}
                        className={`size-5 ${
                          s <= Math.round((featured.tmdbRating || 0) / 2)
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-base-300 text-base-300"
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                    <span className="ml-2 text-xs font-bold text-neutral/55">{featured.tmdbVoteCount?.toLocaleString() || 0} votes</span>
                  </div>
                  <p className="text-xs font-semibold text-neutral/45 leading-relaxed">
                    Aggregated from TMDB users. Not tamper-resistant — subject to review bombing.
                  </p>
                </div>

                {/* ── Community / Onchain Rating ── */}
                <div className="rounded-2xl border border-base-300 bg-base-100 p-5" id="collection">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        <SparklesIcon className="size-3.5" aria-hidden="true" />
                        WatchHub Community
                      </span>
                      <p className="mt-2 text-xs font-semibold text-neutral/55">Monad Testnet · 1 wallet = 1 vote</p>
                    </div>
                    <div className="text-right">
                      {ratingCount > 0 ? (
                        <>
                          <p className="text-3xl font-black text-neutral">{watchHubScore}</p>
                          <p className="text-xs font-semibold text-neutral/55">out of 5</p>
                        </>
                      ) : (
                        <p className="text-2xl font-black text-neutral/30">—</p>
                      )}
                    </div>
                  </div>

                  {ratingCount > 0 ? (
                    <>
                      <div className="flex items-center gap-1 mb-3">
                        {[1,2,3,4,5].map(s => (
                          <StarIcon
                            key={s}
                            className={`size-5 ${
                              s <= Math.round(Number(watchHubScore))
                                ? "fill-primary text-primary"
                                : "fill-base-300 text-base-300"
                            }`}
                            aria-hidden="true"
                          />
                        ))}
                        <span className="ml-2 text-xs font-bold text-neutral/55">{ratingCount} onchain vote{ratingCount !== 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-xs font-semibold text-neutral/45 leading-relaxed">
                        Tamper-resistant: each wallet can only submit one rating per title.
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                      <StarIcon className="size-8 text-neutral/20" aria-hidden="true" />
                      <p className="text-sm font-bold text-neutral/40">No community ratings yet</p>
                      <p className="text-xs font-semibold text-neutral/30">Be the first to rate this title onchain.</p>
                    </div>
                  )}
                </div>

              </div>
            </section>

            {/* ── You Might Like ── */}
            <section id="top-rated">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black text-neutral">You Might Like</h2>
                <button className="min-h-10 rounded-full px-3 text-sm font-bold text-neutral/55 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition">
                  See all
                </button>
              </div>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {data.recommendations.slice(0, 8).map(item => (
                  <article
                    key={`${item.mediaType}-${item.tmdbId}`}
                    className="group overflow-hidden rounded-2xl bg-neutral text-white will-change-transform"
                  >
                    <div className="relative aspect-[1.42] overflow-hidden">
                      <MediaImage
                        src={item.backdropUrl || item.posterUrl}
                        alt={`${item.title} poster`}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105 will-change-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-black leading-tight">{item.title}</h3>
                          <p className="m-0 text-xs font-semibold text-white/70 truncate">
                            {item.year} • TMDB {item.tmdbRating || "N/A"}
                          </p>
                        </div>
                        <CardRatingButton
                          title={item.title}
                          contractId={item.contractId}
                          onRate={writeRating}
                          disabled={isMining}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* ── Featured Cast ── */}
            <section className="rounded-2xl bg-base-100 border border-base-300 p-5">
              <h2 className="text-base font-black text-neutral mb-4">Featured cast</h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3">
                {featured.cast.map(member => (
                  <article key={member.id} className="min-w-0">
                    <MediaImage
                      src={member.profileUrl}
                      alt={member.name}
                      className="aspect-square w-full rounded-2xl object-cover"
                    />
                    <h3 className="mt-2 truncate text-xs font-black text-neutral">{member.name}</h3>
                    <p className="m-0 truncate text-xs font-semibold text-neutral/55">{member.character}</p>
                  </article>
                ))}
              </div>
            </section>

            {/* ══════ REVIEWS — TMDB vs Community ══════ */}
            <section id="reviews">
              <h2 className="mb-3 text-xl font-black text-neutral">Reviews</h2>
              <div className="grid gap-4 lg:grid-cols-2">

                {/* ── TMDB Reviews ── */}
                <div className="rounded-2xl bg-base-100 border border-base-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-500">
                      <FilmIcon className="size-3.5" aria-hidden="true" />
                      TMDB Reviews
                    </span>
                    <span className="text-xs font-semibold text-neutral/40">{featured.reviews.length} fetched</span>
                  </div>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {featured.reviews.length > 0 ? (
                      featured.reviews.map(review => (
                        <article key={review.id} className="rounded-xl bg-base-200 p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="grid size-7 place-items-center rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-black">
                              {review.author.charAt(0).toUpperCase()}
                            </span>
                            <h3 className="truncate text-sm font-black text-neutral">{review.author}</h3>
                          </div>
                          <p className="m-0 text-xs font-semibold leading-5 text-neutral/65 line-clamp-4">{review.content}</p>
                        </article>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                        <ChatBubbleLeftRightIcon className="size-9 text-neutral/20" aria-hidden="true" />
                        <p className="text-sm font-bold text-neutral/40">No TMDB reviews yet</p>
                        <p className="text-xs font-semibold text-neutral/30">TMDB has no critic reviews for this title.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Community Reviews ── */}
                <div className="rounded-2xl bg-base-100 border border-base-300 p-5" id="watched">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      <SparklesIcon className="size-3.5" aria-hidden="true" />
                      Community Reviews
                    </span>
                    <span className="text-xs font-semibold text-neutral/40">Wallet-gated</span>
                  </div>

                  {/* Review submit form */}
                  {connectedAddress ? (
                    <div className="mb-4">
                      <label className="sr-only" htmlFor="review-input">Write a community review</label>
                      <textarea
                        id="review-input"
                        ref={reviewTextRef}
                        value={reviewText}
                        onChange={e => setReviewText(e.target.value)}
                        placeholder={`Share your thoughts on ${featured.title}… (min 10 characters)`}
                        rows={3}
                        maxLength={1000}
                        className="w-full resize-none rounded-2xl border border-base-300 bg-base-200 p-3 text-sm font-medium text-neutral placeholder:text-neutral/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-neutral/40">{reviewText.length}/1000</span>
                        <button
                          onClick={submitReview}
                          disabled={reviewSubmitting || reviewText.trim().length < 10}
                          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-content transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChatBubbleLeftRightIcon className="size-3.5" aria-hidden="true" />
                          {reviewSubmitting ? "Posting…" : "Post review"}
                        </button>
                      </div>
                      {reviewError && (
                        <p className="mt-2 text-xs font-bold text-error">{reviewError}</p>
                      )}
                      {reviewSuccess && (
                        <p className="mt-2 text-xs font-bold text-success">Review posted! 🎉</p>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4 rounded-2xl border border-dashed border-base-300 p-4 text-center">
                      <p className="text-xs font-semibold text-neutral/50 mb-2">Connect your wallet to leave a review</p>
                      <RainbowKitCustomConnectButton />
                    </div>
                  )}

                  {/* Reviews list */}
                  {reviewsLoading ? (
                    <div className="space-y-3">
                      {[1,2].map(i => (
                        <div key={i} className="animate-pulse rounded-xl bg-base-200 h-20" />
                      ))}
                    </div>
                  ) : reviews.length > 0 ? (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {reviews.map(review => (
                        <article key={review.id} className="rounded-xl bg-base-200 p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary text-[10px] font-black shrink-0">
                              {review.wallet_address.slice(2, 4).toUpperCase()}
                            </span>
                            <h3 className="truncate text-sm font-black text-neutral">
                              {review.wallet_address.slice(0, 6)}…{review.wallet_address.slice(-4)}
                            </h3>
                            <span className="ml-auto shrink-0 text-[10px] font-semibold text-neutral/40">
                              {new Date(review.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="m-0 text-xs font-semibold leading-5 text-neutral/65">{review.content}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                      <ChatBubbleLeftRightIcon className="size-9 text-neutral/20" aria-hidden="true" />
                      <p className="text-sm font-bold text-neutral/40">No community reviews yet</p>
                      <p className="text-xs font-semibold text-neutral/30">Be the first to share your thoughts.</p>
                    </div>
                  )}
                </div>

              </div>
            </section>

            {/* ── AI Mood Picks CTA ── */}
            <section className="grid gap-4 rounded-2xl bg-gradient-to-br from-primary/10 via-base-100 to-base-100 border border-primary/20 p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-content">
                  <SparklesIcon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-neutral">AI mood picks</h2>
                  <p className="m-0 text-sm font-semibold text-neutral/60">
                    Recommendation chat filters the live TMDB list by mood, genre, and runtime.
                  </p>
                </div>
              </div>
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-neutral px-6 text-sm font-bold text-neutral-content transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <TvIcon className="size-5" aria-hidden="true" />
                Recommend
              </button>
            </section>

            <p className="text-center text-xs font-semibold text-neutral/50">{data.attribution}</p>
          </main>
        </div>
      </div>

      {/* ════ MOBILE BOTTOM NAV ════ */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-base-300 bg-base-100/95 backdrop-blur flex items-center justify-around px-2 pb-safe"
      >
        <Link
          href="/"
          className="flex flex-col items-center gap-1 py-3 px-3 text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          <HomeIcon className="size-6" aria-hidden="true" />
          <span className="text-[10px] font-bold">Explore</span>
        </Link>
        <a
          href="#top-rated"
          className="flex flex-col items-center gap-1 py-3 px-3 text-neutral/60 hover:text-primary transition focus-visible:outline-2 focus-visible:outline-primary"
        >
          <StarIcon className="size-6" aria-hidden="true" />
          <span className="text-[10px] font-bold">Top rated</span>
        </a>
        <a
          href="#collection"
          className="flex flex-col items-center gap-1 py-3 px-3 text-neutral/60 hover:text-primary transition focus-visible:outline-2 focus-visible:outline-primary"
        >
          <BookmarkIcon className="size-6" aria-hidden="true" />
          <span className="text-[10px] font-bold">Collection</span>
        </a>
        <a
          href="#watched"
          className="flex flex-col items-center gap-1 py-3 px-3 text-neutral/60 hover:text-primary transition focus-visible:outline-2 focus-visible:outline-primary"
        >
          <CheckCircleIcon className="size-6" aria-hidden="true" />
          <span className="text-[10px] font-bold">Watched</span>
        </a>
        <Link
          href="/debug"
          className="flex flex-col items-center gap-1 py-3 px-3 text-neutral/60 hover:text-primary transition focus-visible:outline-2 focus-visible:outline-primary"
        >
          <BugAntIcon className="size-6" aria-hidden="true" />
          <span className="text-[10px] font-bold">Debug</span>
        </Link>
      </nav>
    </>
  );
};

export default Home;

