// app/api/memes/user/[walletAddress]/route.ts
import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";

export async function GET(
  request: Request,
  { params }: { params: { walletAddress: string } }
) {
  try {
    const db = (await dbConnect()).connection.db;
    const usersCollection = db.collection("users");
    const memesCollection = db.collection("memes");

    const user = await usersCollection.findOne({
      walletAddress: params.walletAddress.toLowerCase(),
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
