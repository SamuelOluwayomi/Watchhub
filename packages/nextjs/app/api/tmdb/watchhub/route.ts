import { NextResponse } from "next/server";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const TV_ID_OFFSET = 1_000_000_000n;
const ANIMATION_GENRE_ID = 16;
const DEFAULT_PAGE_COUNT = 3;

type MediaType = "movie" | "tv";

type TmdbGenre = {
  id: number;
  name: string;
};

type TmdbListItem = {
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
};

type TmdbListResponse = {
  results: TmdbListItem[];
};

type TmdbGenresResponse = {
  genres: TmdbGenre[];
};

type TmdbConfigurationResponse = {
  images?: {
    secure_base_url?: string;
  };
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

type TmdbDetails = TmdbListItem & {
  runtime?: number;
  number_of_seasons?: number;
  genres?: TmdbGenre[];
  credits?: {
    cast?: TmdbCastMember[];
  };
  reviews?: {
    results?: TmdbReview[];
  };
};

type NormalizedItem = {
  tmdbId: number;
  contractId: string;
  mediaType: MediaType;
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

const isBearerToken = (value: string) => value.startsWith("eyJ") || value.startsWith("tmdb_");

const getAuth = () => {
  const rawKey = process.env.TMDB_API_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY;

  if (!rawKey) {
    throw new Error("Missing TMDB_API_KEY or TMDB_API_READ_ACCESS_TOKEN in packages/nextjs/.env.local");
  }

  return {
    key: rawKey,
    useBearer: isBearerToken(rawKey),
  };
};

const tmdbFetch = async <T>(path: string, params: Record<string, string | number> = {}) => {
  const auth = getAuth();
  const url = new URL(`${TMDB_API_BASE_URL}${path}`);

  Object.entries({ language: "en-US", ...params }).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
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

const getTitle = (item: TmdbListItem) => item.title || item.name || "Untitled";

const getContractId = (mediaType: MediaType, tmdbId: number) => {
  if (mediaType === "tv") return (TV_ID_OFFSET + BigInt(tmdbId)).toString();
  return String(tmdbId);
};

const normalizeItem = (
  item: TmdbListItem,
  mediaType: MediaType,
  genresByType: Record<MediaType, Map<number, string>>,
  imageBaseUrl: string,
): NormalizedItem => {
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
};

const dedupeItems = (items: NormalizedItem[]) => {
  const seen = new Set<string>();
  const deduped: NormalizedItem[] = [];

  items.forEach(item => {
    const key = `${item.mediaType}:${item.tmdbId}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  });

  return deduped;
};

export async function GET() {
  try {
    const [configuration, movieGenres, tvGenres] = await Promise.all([
      tmdbFetch<TmdbConfigurationResponse>("/configuration"),
      tmdbFetch<TmdbGenresResponse>("/genre/movie/list"),
      tmdbFetch<TmdbGenresResponse>("/genre/tv/list"),
    ]);

    const imageBaseUrl = configuration.images?.secure_base_url || "https://image.tmdb.org/t/p/";
    const genresByType = {
      movie: new Map(movieGenres.genres.map(genre => [genre.id, genre.name])),
      tv: new Map(tvGenres.genres.map(genre => [genre.id, genre.name])),
    };

    const fetchPagedItems = async (
      path: string,
      mediaType: MediaType,
      params: Record<string, string | number> = {},
      pages = DEFAULT_PAGE_COUNT,
    ) => {
      const requests = Array.from({ length: pages }, (_, index) =>
        tmdbFetch<TmdbListResponse>(path, { ...params, page: index + 1 }),
      );

      const responses = await Promise.all(requests);
      return responses.flatMap(response =>
        response.results.map(item => normalizeItem(item, mediaType, genresByType, imageBaseUrl)),
      );
    };

    const [movieDiscover, movieTopRated, movieAnimation, tvDiscover, tvTopRated, tvAnimation] = await Promise.all([
      fetchPagedItems("/discover/movie", "movie", { sort_by: "popularity.desc" }, 3),
      fetchPagedItems("/movie/top_rated", "movie", {}, 2),
      fetchPagedItems("/discover/movie", "movie", { with_genres: ANIMATION_GENRE_ID, sort_by: "popularity.desc" }, 2),
      fetchPagedItems("/discover/tv", "tv", { sort_by: "popularity.desc" }, 3),
      fetchPagedItems("/tv/top_rated", "tv", {}, 2),
      fetchPagedItems("/discover/tv", "tv", { with_genres: ANIMATION_GENRE_ID, sort_by: "popularity.desc" }, 2),
    ]);

    const pool = dedupeItems([
      ...movieDiscover,
      ...movieTopRated,
      ...movieAnimation,
      ...tvDiscover,
      ...tvTopRated,
      ...tvAnimation,
    ]);

    if (!pool.length) {
      return NextResponse.json({ message: "TMDB returned no titles." }, { status: 404 });
    }

    const featuredSeed = pool.find(item => item.backdropUrl && item.overview) || pool[0];

    const featuredDetails = await tmdbFetch<TmdbDetails>(`/${featuredSeed.mediaType}/${featuredSeed.tmdbId}`, {
      append_to_response: "credits,reviews",
    });

    const featured = {
      ...normalizeItem(featuredDetails, featuredSeed.mediaType, genresByType, imageBaseUrl),
      runtime: featuredDetails.runtime ? `${featuredDetails.runtime}m` : null,
      cast:
        featuredDetails.credits?.cast
          ?.sort((a, b) => (a.order || 0) - (b.order || 0))
          .slice(0, 5)
          .map(member => ({
            id: member.id,
            name: member.name,
            character: member.character || "Cast",
            profileUrl: imageUrl(imageBaseUrl, "w185", member.profile_path),
          })) || [],
      reviews:
        featuredDetails.reviews?.results?.slice(0, 4).map(review => ({
          id: review.id,
          author: review.author,
          content: review.content.length > 240 ? `${review.content.slice(0, 240)}...` : review.content,
        })) || [],
    };

    const recommendations = pool.filter(item => item.posterUrl || item.backdropUrl).slice(0, 18);
    const continueWatching = pool.filter(item => item.posterUrl).slice(0, 8);

    const preferredGenres = ["Animation", "Thriller", "Drama", "Action", "Comedy"];
    const categories = [
      "Movies",
      "TV Series",
      ...preferredGenres.filter(genre => movieGenres.genres.some(item => item.name === genre)),
    ];

    return NextResponse.json({
      featured,
      recommendations,
      continueWatching,
      categories,
      attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load TMDB data.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
