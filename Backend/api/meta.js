export default function handler(req, res) {
  if (req.method === "GET") {
    const metaData = {
      buildings: ["Ayuntamiento", "JFH", "ICTC", "PCH", "Food Square", "COS", "CBAA", "CTHM", "GMH", "CEAT"],
      concerns: [
        {
          id: "electrical",
          label: "Electrical",
          subconcerns: ["Lights", "Aircons", "Wires", "Outlets", "Switches", "Other"],
        },
        {
          id: "civil",
          label: "Civil",
          subconcerns: ["Walls", "Ceilings", "Cracks", "Doors", "Windows", "Other"],
        },
        {
          id: "mechanical",
          label: "Mechanical",
          subconcerns: ["TV", "Projectors", "Fans", "Elevators", "Other"],
        },
        {
          id: "safety-hazard",
          label: "Safety Hazard",
          subconcerns: ["Spikes", "Open Wires", "Blocked Exits", "Wet Floor", "Other"],
        },
        {
          id: "other",
          label: "Other",
          subconcerns: ["Other"],
        },
      ],
    };

    res.status(200).json(metaData);
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}
