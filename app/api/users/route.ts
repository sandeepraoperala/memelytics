// app/api/users/route.ts
import { NextResponse } from "next/server";
import dbConnect from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request: Request) {
  try {
    const db = (await dbConnect()).connection.db;
    const usersCollection = db.collection("users");

    const { walletAddress } = await request.json();
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    const lowerAddress = walletAddress.toLowerCase();
    let user = await usersCollection.findOne({ walletAddress: lowerAddress });

    if (user) {
      return NextResponse.json(
        { message: "User already exists", user },
        { status: 200 }
      );
    }

    user = {
      walletAddress: lowerAddress,
      createdAt: new Date(),
      memes: [], // Store ObjectId strings
    };
    const result = await usersCollection.insertOne(user);
    user._id = result.insertedId;

    return NextResponse.json(
      { message: "User created", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
