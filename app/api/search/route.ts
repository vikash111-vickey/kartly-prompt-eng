import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "Search API placeholder" });
}

export async function GET() {
  return NextResponse.json({ message: "Search API placeholder" });
}
