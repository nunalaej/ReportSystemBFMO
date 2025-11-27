// app/api/meta/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";

// schema for Buildings & Concern collection
const MetaSchema = new mongoose.Schema(
  {
    buildings: [String],
    concerns: [
      {
        id: String,
        label: String,
        subconcerns: [String],
      },
    ],
  },
  { collection: "Buildings&Concern" }
);

const Meta = mongoose.models.Meta || mongoose.model("Meta", MetaSchema);

export async function GET() {
  try {
    await connectDB();
    const doc = await Meta.findOne().lean();
    return NextResponse.json(doc || { buildings: [], concerns: [] });
  } catch (err) {
    console.error("GET /api/meta error:", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    const updated = await Meta.findOneAndUpdate(
      {},
      {
        buildings: body.buildings ?? [],
        concerns: body.concerns ?? [],
      },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/meta error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
