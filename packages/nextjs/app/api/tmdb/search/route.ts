import { NextRequest, NextResponse } from "next/server";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const TV_ID_OFFSET = 1_000_000_000n;

type MediaType = "movie" | "tv";

type TmdbGenre = { id: number; name: string };
type TmdbSearchItem = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
};

type TmdbSearchResponse = { results: TmdbSearchItem[] };
type TmdbGenresResponse = { genres: TmdbGenre[] };
type TmdbConfigurationResponse = { images?: { secure_base_url?: string } };

const isBearerToken = (value: string) => value.startsWith("eyJ") || value.startsWith("tmdb_");

const getAuth = () => {
  const rawKey = process.env.TMDB_API_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY;
  if (!rawKey) {
    throw new Error("Missing TMDB_API_KEY or TMDB_API_READ_ACCESS_TOKEN");
  }
  return { key: rawKey, useBearer: isBearerToken(rawKey) };
};

const tmdbFetch = async <T>(path: string, params: Record<string, string> = {}) => {
  const auth = getAuth();
  const url = new URL(`${TMDB_API_BASE_URL}${path}`);
  Object.entries({ language: "en-US", ...params }).forEach(([key, value]) => url.searchParams.set(key, value));

  const headers: HeadersInit = { accept: "application/json" };
  if (auth.useBearer) {
    headers.Authorization = `Bearer ${auth.key}`;
  } else {
    url.searchParams.set("api_key", auth.key);
  }

  const response = await fetch(url, { headers, next: { revalidate: 300 } });
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
const getTitle = (item: TmdbSearchItem) => item.title || item.name || "Untitled";
const getContractId = (mediaType: MediaType, tmdbId: number) => {
  if (mediaType === "tv") return (TV_ID_OFFSET + BigInt(tmdbId)).toString();
  return String(tmdbId);
};

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("query")?.trim();
    if (!query) {
      return NextResponse.json({ message: "Query is required" }, { status: 400 });
    }

    const [configuration, movieGenres, tvGenres, searchResults] = await Promise.all([
      tmdbFetch<TmdbConfigurationResponse>("/configuration"),
      tmdbFetch<TmdbGenresResponse>("/genre/movie/list"),
      tmdbFetch<TmdbGenresResponse>("/genre/tv/list"),
      tmdbFetch<TmdbSearchResponse>("/search/multi", { query }),
    ]);

    const imageBaseUrl = configuration.images?.secure_base_url || "https://image.tmdb.org/t/p/";
    const genresByType = {
      movie: new Map(movieGenres.genres.map(genre => [genre.id, genre.name])),
      tv: new Map(tvGenres.genres.map(genre => [genre.id, genre.name])),
    };

    const results = searchResults.results
      .filter(item => item.media_type === "movie" || item.media_type === "tv")
      .map(item => {
        const mediaType = item.media_type as MediaType;
        const releaseDate = mediaType === "movie" ? item.release_date : item.first_air_date;
        const genreNames =
          item.genre_ids
            ?.map(id => genresByType[mediaType].get(id))
            .filter((name): name is string => Boolean(name)) || [];

        return {
          tmdbId: item.id,
          contractId: getContractId(mediaType, item.id),
          mediaType,
          typeLabel: mediaType === "movie" ? "Movie" : "Series",
          title: getTitle(item),
          overview: item.overview || "No synopsis available yet.",
          year: getYear(releaseDate),
          genres: genreNames,
          posterUrl: imageUrl(imageBaseUrl, "w500", item.poster_path),
          backdropUrl: imageUrl(imageBaseUrl, "w1280", item.backdrop_path),
          tmdbRating: Number((item.vote_average || 0).toFixed(1)),
          tmdbVoteCount: item.vote_count || 0,
        };
      })
      .slice(0, 12);

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to search TMDB.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
