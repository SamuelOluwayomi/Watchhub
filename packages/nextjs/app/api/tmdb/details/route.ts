import { NextRequest, NextResponse } from "next/server";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const TV_ID_OFFSET = 1_000_000_000n;

type MediaType = "movie" | "tv";

type TmdbGenre = {
  id: number;
  name: string;
};

type TmdbCastMember = {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
};

type TmdbReview = {
  id: string;
  author: string;
  content: string;
};

type TmdbDetails = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  runtime?: number;
  number_of_seasons?: number;
  genres?: TmdbGenre[];
  credits?: {
    cast?: TmdbCastMember[];
  };
  reviews?: {
    results?: TmdbReview[];
  };
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
};

const isBearerToken = (value: string) => value.startsWith("eyJ") || value.startsWith("tmdb_");

const getAuth = () => {
  const rawKey = process.env.TMDB_API_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY;
  if (!rawKey) {
    throw new Error("Missing TMDB_API_KEY or TMDB_API_READ_ACCESS_TOKEN");
  }
  return {
    key: rawKey,
    useBearer: isBearerToken(rawKey),
  };
};

const tmdbFetch = async <T>(path: string, params: Record<string, string> = {}) => {
  const auth = getAuth();
  const url = new URL(`${TMDB_API_BASE_URL}${path}`);
  Object.entries({ language: "en-US", ...params }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const headers: HeadersInit = {
    accept: "application/json",
  };

  if (auth.useBearer) {
    headers.Authorization = `Bearer ${auth.key}`;
  } else {
    url.searchParams.set("api_key", auth.key);
  }

  const response = await fetch(url, {
    headers,
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`TMDB request failed for ${path}: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const imageUrl = (baseUrl: string, size: string, filePath?: string | null) => {
  if (!filePath) return null;
  return `${baseUrl}${size}${filePath}`;
};

const getYear = (value?: string) => (value ? value.slice(0, 4) : "TBA");
const getTitle = (item: TmdbDetails) => item.title || item.name || "Untitled";
const getContractId = (mediaType: MediaType, tmdbId: number) => {
  if (mediaType === "tv") return (TV_ID_OFFSET + BigInt(tmdbId)).toString();
  return String(tmdbId);
};

export async function GET(req: NextRequest) {
  try {
    const idStr = req.nextUrl.searchParams.get("id");
    const mediaType = req.nextUrl.searchParams.get("mediaType") as MediaType;

    if (!idStr || !mediaType || !["movie", "tv"].includes(mediaType)) {
      return NextResponse.json({ message: "Invalid parameters" }, { status: 400 });
    }

    const id = parseInt(idStr, 10);
    const details = await tmdbFetch<TmdbDetails>(`/${mediaType}/${id}`, {
      append_to_response: "credits,reviews",
    });

    const configuration = await tmdbFetch<{ images?: { secure_base_url?: string } }>("/configuration");
    const imageBaseUrl = configuration.images?.secure_base_url || "https://image.tmdb.org/t/p/";

    const releaseDate = mediaType === "movie" ? details.release_date : details.first_air_date;
    const runtimeVal = details.runtime
      ? `${details.runtime}m`
      : details.number_of_seasons
        ? `${details.number_of_seasons} Season${details.number_of_seasons > 1 ? "s" : ""}`
        : null;

    const featured = {
      tmdbId: details.id,
      contractId: getContractId(mediaType, details.id),
      mediaType,
      typeLabel: mediaType === "movie" ? "Movie" : "Series",
      title: getTitle(details),
      overview: details.overview || "No synopsis available yet.",
      year: getYear(releaseDate),
      genres: details.genres?.slice(0, 2).map(g => g.name) || [],
      posterUrl: imageUrl(imageBaseUrl, "w500", details.poster_path),
      backdropUrl: imageUrl(imageBaseUrl, "w1280", details.backdrop_path),
      tmdbRating: Number((details.vote_average || 0).toFixed(1)),
      tmdbVoteCount: details.vote_count || 0,
      runtime: runtimeVal,
      cast:
        details.credits?.cast
          ?.sort((a, b) => (a.order || 0) - (b.order || 0))
          .slice(0, 6)
          .map(member => ({
            id: member.id,
            name: member.name,
            character: member.character || "Cast",
            profileUrl: imageUrl(imageBaseUrl, "w185", member.profile_path),
          })) || [],
      reviews:
        details.reviews?.results?.slice(0, 2).map(review => ({
          id: review.id,
          author: review.author,
          content: review.content.length > 240 ? `${review.content.slice(0, 240)}...` : review.content,
        })) || [],
    };

    return NextResponse.json({ details: featured });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load details.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
