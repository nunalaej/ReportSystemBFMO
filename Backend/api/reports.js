import { connectDB } from "@/lib/mongodb";
import { Report } from "@/models/Report";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      await connectDB();

      const newReport = new Report({
        ...req.body,
      });

      const savedReport = await newReport.save();

      res.status(200).json({
        success: true,
        message: "Report submitted successfully",
        report: savedReport,
      });
    } catch (error) {
      console.error("Error saving report:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}
