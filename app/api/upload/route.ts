// app/api/upload/route.ts
import { NextResponse } from "next/server";
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
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 5MB" },
        { status: 400 }
      );
    }

    const fileName = `${uuidv4()}-${file.name}`;
    const key = `uploads/${fileName}`; // Organize files in 'uploads' folder in R2
    const buffer = await file.arrayBuffer();

    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: file.type,
      ACL: "public-read",
    };

    await s3.send(new PutObjectCommand(uploadParams));
    const publicPath = `${s3.config.endpoint!.href}${bucketName}/${key}`;

    return NextResponse.json({ url: publicPath }, { status: 200 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
