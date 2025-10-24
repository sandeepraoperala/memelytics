// app/api/users/[walletAddress]/route.ts
import { NextResponse, NextRequest } from "next/server";
import dbConnect from "../../../../lib/mongodb";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const db = (await dbConnect()).connection.db;
    const usersCollection = db.collection("users");

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

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
