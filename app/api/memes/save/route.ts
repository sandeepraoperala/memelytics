// app/api/memes/save/route.ts
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/mongodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});
const bucketName = process.env.R2_BUCKET_NAME!;

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

    // Convert base64 dataUrl to buffer
    const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
    const fileName = `${uuidv4()}.png`;
    const key = `memes/${fileName}`; // Organize files in 'memes' folder in R2

    // Upload to Cloudflare R2
    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
      ACL: "public-read", // Make the file publicly accessible
    };

    await s3.send(new PutObjectCommand(uploadParams));
    const imageUrl = `https://pub-b41b04214ecc4b1ea89d95ffe73bf730.r2.dev/${key}`;

    const meme = {
      userId: user._id,
      imageUrl, // Store R2 URL
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
