// app/api/reports/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "../../lib/mongodb";
import Report from "../../models/Report";

export async function GET() {
  try {
    await connectDB();

    const reports = await Report.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load reports" },
      { status: 500 }
    );
  }
}
