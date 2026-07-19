import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, items } = body as { prompt: string; items: WatchHubItem[] };

    if (!prompt?.trim()) {
      return NextResponse.json({ message: "Prompt is required" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: "No items to recommend from" }, { status: 400 });
    }

    const normalizedPrompt = prompt.toLowerCase();

    // Map common mood keywords to genres & attributes
    const genreKeywords: Record<string, string[]> = {
      action: ["action", "fight", "superhero", "explosive", "thrill", "chase"],
      comedy: ["comedy", "funny", "laugh", "hilarious", "humor", "joke", "spoof"],
      drama: ["drama", "serious", "emotional", "intense", "sad", "tear", "deep"],
      thriller: ["thriller", "suspense", "mystery", "scary", "crime", "detective"],
      scifi: ["sci-fi", "science fiction", "space", "alien", "robot", "future", "futuristic"],
      horror: ["horror", "scary", "ghost", "monster", "blood", "creepy", "dark"],
      romance: ["romance", "love", "romantic", "couple", "drama"],
      animation: ["animation", "animated", "cartoon", "anime", "kids", "family"],
    };

    // Calculate match score for each item
    const scoredItems = items.map(item => {
      let score = 0;
      const titleLower = item.title.toLowerCase();
      const overviewLower = item.overview.toLowerCase();
      const genresLower = item.genres.map(g => g.toLowerCase());

      // Direct genre matches
      for (const [genre, keywords] of Object.entries(genreKeywords)) {
        const hasGenre = genresLower.includes(genre);
        const matchesPrompt = keywords.some(kw => normalizedPrompt.includes(kw));

        if (hasGenre && matchesPrompt) {
          score += 10; // High match for genre
        } else if (matchesPrompt) {
          // Check if item's title or overview has matches
          const wordMatches = keywords.some(kw => titleLower.includes(kw) || overviewLower.includes(kw));
          if (wordMatches) {
            score += 5;
          }
        }
      }

      // Media type preference
      if (normalizedPrompt.includes("series") || normalizedPrompt.includes("show") || normalizedPrompt.includes("tv")) {
        if (item.mediaType === "tv") score += 5;
      }
      if (normalizedPrompt.includes("movie") || normalizedPrompt.includes("film")) {
        if (item.mediaType === "movie") score += 5;
      }

      // Keyword matches in title / overview
      const words = normalizedPrompt.split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) {
          if (titleLower.includes(word)) score += 3;
          if (overviewLower.includes(word)) score += 1;
        }
      });

      return { item, score };
    });

    // Sort by score desc, fallback to tmdbRating
    const sorted = scoredItems
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || b.item.tmdbRating - a.item.tmdbRating);

    // Pick top 3 recommendations
    const topMatches = sorted.slice(0, 3).map(x => x.item);

    // If no matches, fall back to top rated
    const recommendations =
      topMatches.length > 0 ? topMatches : items.sort((a, b) => b.tmdbRating - a.tmdbRating).slice(0, 3);

    // Generate personalized AI reasoning
    let reasoning = "";
    if (topMatches.length > 0) {
      reasoning = `Based on your mood for "${prompt}", I scanned our Monad community database and found titles that fit. Here are the top matches that highlight your preferred themes.`;
    } else {
      reasoning = `I couldn't find exact matches for "${prompt}", but here are some of the highest-rated titles currently trending on WatchHub that you might enjoy!`;
    }

    return NextResponse.json({
      recommendations,
      reasoning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate recommendations.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
