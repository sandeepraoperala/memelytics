// app/api/memes/update/[memeId]/route.ts
import { NextResponse, NextRequest } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const db = (await dbConnect()).connection.db;
    const memesCollection = db.collection("memes");

    // Extract memeId from the URL path
    const url = new URL(request.url);
    const memeId = url.pathname.split("/").pop(); // Gets the last segment of the path

    if (!memeId) {
      return NextResponse.json({ error: "Missing memeId" }, { status: 400 });
    }

    const { action } = (await request.json()) as { action?: string };

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    if (action === "download") {
      await memesCollection.updateOne(
        { _id: new ObjectId(memeId) },
        { $inc: { downloads: 1 } }
      );
    } else if (action === "share") {
      await memesCollection.updateOne(
        { _id: new ObjectId(memeId) },
        { $inc: { shares: 1 } }
      );
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ message: "Updated successfully" });
  } catch (error) {
    console.error("Error updating meme:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
