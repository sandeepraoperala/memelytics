// app/api/users/[walletAddress]/route.ts
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";

export async function GET(
  request: Request,
  { params }: { params: { walletAddress: string } }
) {
  try {
    const db = (await dbConnect()).connection.db;
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({
      walletAddress: params.walletAddress.toLowerCase(),
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
