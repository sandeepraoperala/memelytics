// app/api/memes/update/[memeId]/route.ts
import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(
  request: Request,
  { params }: { params: { memeId: string } }
) {
  try {
    const db = (await dbConnect()).connection.db;
    const memesCollection = db.collection("memes");

    const { action } = await request.json();
    if (action === "download") {
      await memesCollection.updateOne(
        { _id: new ObjectId(params.memeId) },
        { $inc: { downloads: 1 } }
      );
    } else if (action === "share") {
      await memesCollection.updateOne(
        { _id: new ObjectId(params.memeId) },
        { $inc: { shares: 1 } }
      );
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("Error updating meme:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
