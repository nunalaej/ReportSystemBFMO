// app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { connectDB } from "@/lib/mongodb";
import { Report } from "@/lib/models/report";

export const runtime = "nodejs"; // ensure Node runtime, not edge

// GET /api/reports - list all reports (used by your similarity counter)
export async function GET() {
  try {
    await connectDB();
    const reports = await Report.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(reports);
  } catch (err) {
    console.error("Get reports error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

// POST /api/reports - create a new report from multipart form-data
export async function POST(req: NextRequest) {
  try{
    await connectDB();

    const formData = await req.formData();

    const email = (formData.get("email") as string) || "";
    const heading = (formData.get("heading") as string) || "";
    const description = (formData.get("description") as string) || "";

    const concern = (formData.get("concern") as string) || "";
    const subConcern = (formData.get("subConcern") as string) || "";
    const otherConcern = (formData.get("otherConcern") as string) || "";

    const building = (formData.get("building") as string) || "";
    const otherBuilding = (formData.get("otherBuilding") as string) || "";
    const college = (formData.get("college") as string) || "Unspecified";
    const room = (formData.get("room") as string) || "";
    const otherRoom = (formData.get("otherRoom") as string) || "";

    const file = formData.get("ImageURL") as File | null;

    let imageUrl: string | null = null;

    // Optional - save image locally (works in dev; in Vercel this is temporary)
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const filename = `${Date.now()}-${safeName}`;
      const filePath = path.join(uploadsDir, filename);

      await fs.writeFile(filePath, buffer);
      imageUrl = `/uploads/${filename}`;
    }

    const report = await Report.create({
      email,
      heading,
      description,
      concern,
      subConcern,
      otherConcern,
      building,
      otherBuilding,
      college,
      room,
      otherRoom,
      image: imageUrl,
    });

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error("Report submission error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to submit" },
      { status: 500 }
    );
  }
}
