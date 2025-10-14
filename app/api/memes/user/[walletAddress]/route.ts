import { NextResponse, NextRequest } from "next/server";
import dbConnect from "../../../../../lib/mongodb";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const db = (await dbConnect()).connection.db;
    const usersCollection = db.collection("users");
    const memesCollection = db.collection("memes");

    // Extract walletAddress from the URL path
    const url = new URL(request.url);
    const walletAddress = url.pathname.split("/").pop(); // Gets the last segment of the path

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    const user = await usersCollection.findOne({
      walletAddress: walletAddress.toLowerCase(),
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const memes = await memesCollection
      .find({ userId: user._id })
      .sort({ createdAt: -1 })
      .toArray();
    return NextResponse.json(memes);
  } catch (error) {
    console.error("Error fetching memes:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
