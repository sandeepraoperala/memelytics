// app/api/memes/save/route.ts
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { ObjectId } from "mongodb";

const uploadDir = path.join(process.cwd(), "public/uploads");

export async function POST(request: Request) {
  try {
    const db = (await dbConnect()).connection.db;
    const usersCollection = db.collection("users");
    const memesCollection = db.collection("memes");

    const { walletAddress, dataUrl, type, tags } = await request.json();
    if (!walletAddress || !dataUrl || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const user = await usersCollection.findOne({
      walletAddress: walletAddress.toLowerCase(),
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Save image to local file system
    await fs.mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
    const fileName = `${uuidv4()}.png`;
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer);
    const imageUrl = `/uploads/${fileName}`;

    const meme = {
      userId: user._id,
      imageUrl,
      type,
      tags: tags || [],
      createdAt: new Date(),
      downloads: 0,
      shares: 0,
    };
    const result = await memesCollection.insertOne(meme);
    const memeId = result.insertedId;

    // Update user's memes array
    await usersCollection.updateOne(
      { _id: user._id },
      { $push: { memes: memeId } }
    );

    return NextResponse.json({ message: "Meme saved", memeId });
  } catch (error) {
    console.error("Error saving meme:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
