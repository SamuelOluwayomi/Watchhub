import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabaseHeaders = () => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON_KEY!,
  Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
});

// GET /api/reviews?movieId=<contractId>
export async function GET(req: NextRequest) {
  const movieId = req.nextUrl.searchParams.get("movieId");
  if (!movieId) {
    return NextResponse.json({ message: "movieId query param is required" }, { status: 400 });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ reviews: [] }); // gracefully return empty if not configured
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/watchhub_reviews?movie_id=eq.${encodeURIComponent(movieId)}&order=created_at.desc&limit=20`;
    const res = await fetch(url, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase GET failed: ${res.status}`);
    const reviews = await res.json();
    return NextResponse.json({ reviews });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch reviews";
    return NextResponse.json({ message }, { status: 500 });
  }
}

// POST /api/reviews
// Body: { movieId: string, walletAddress: string, content: string, movieTitle: string }
export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ message: "Supabase is not configured on this server." }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { movieId, walletAddress, content, movieTitle } = body;

    if (!movieId || !walletAddress || !content?.trim()) {
      return NextResponse.json({ message: "movieId, walletAddress, and content are required" }, { status: 400 });
    }
    if (content.trim().length < 10) {
      return NextResponse.json({ message: "Review must be at least 10 characters" }, { status: 400 });
    }
    if (content.trim().length > 1000) {
      return NextResponse.json({ message: "Review must be under 1000 characters" }, { status: 400 });
    }

    const url = `${SUPABASE_URL}/rest/v1/watchhub_reviews`;
    const res = await fetch(url, {
      method: "POST",
      headers: { ...supabaseHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        movie_id: movieId,
        wallet_address: walletAddress.toLowerCase(),
        content: content.trim(),
        movie_title: movieTitle || "",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Handle duplicate review (unique constraint violation)
      if (res.status === 409 || (err as { code?: string }).code === "23505") {
        return NextResponse.json({ message: "You have already reviewed this title." }, { status: 409 });
      }
      throw new Error(`Supabase POST failed: ${res.status}`);
    }

    const [review] = await res.json();
    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit review";
    return NextResponse.json({ message }, { status: 500 });
  }
}
