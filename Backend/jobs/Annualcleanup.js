// jobs/annualCleanup.js
//

//this is changed
// PURPOSE
// -------
// Every year on July 30 at 02:00 AM server time:
//   1. Find every Report whose status is "Resolved" OR "Archived".
//   2. Copy each document verbatim into the `archived_reports` collection
//      (so analytics queries can still count them).
//   3. Delete the originals from the `reports` collection.
//
// The analytics page queries BOTH collections when building its charts,
// so the numbers remain accurate even after cleanup.
//
// HOW TO USE
// ----------
// Import and call  scheduleAnnualCleanup()  once when your Express server
// starts (e.g. in server.js / app.js after DB connection is ready).
//
//   const { scheduleAnnualCleanup } = require("./jobs/annualCleanup");
//   scheduleAnnualCleanup();
//
// DEPENDENCIES
//   npm install node-cron
//
// ENVIRONMENT VARIABLES (optional)
//   CLEANUP_DRY_RUN=true   → logs what would be deleted without actually deleting
//   CLEANUP_FORCE_NOW=true → runs the cleanup immediately on startup (for testing)

const cron = require("node-cron");
const Report         = require("../models/Report");
const ArchivedReport = require("../models/ArchivedReport");

/* ============================================================
   CORE CLEANUP LOGIC
============================================================ */

/**
 * Move all Resolved / Archived reports to the analytics archive,
 * then delete them from the main reports collection.
 *
 * @param {object} opts
 * @param {boolean} [opts.dryRun=false]  - If true, log only; do not write.
 * @returns {Promise<{ moved: number, errors: number }>}
 */
async function runAnnualCleanup({ dryRun = false } = {}) {
  const startedAt = new Date();
  const purgeYear  = startedAt.getFullYear();

  console.log(
    `[annualCleanup] Starting ${dryRun ? "(DRY RUN) " : ""}– ${startedAt.toISOString()}`
  );

  // ── 1. Find all eligible reports ──────────────────────────────────────────
  const eligible = await Report.find({
    status: { $in: ["Resolved", "Archived"] },
  }).lean();

  console.log(`[annualCleanup] Found ${eligible.length} eligible report(s).`);

  if (eligible.length === 0) {
    console.log("[annualCleanup] Nothing to do.");
    return { moved: 0, errors: 0 };
  }

  if (dryRun) {
    console.log("[annualCleanup] DRY RUN – skipping writes.");
    eligible.forEach((r) =>
      console.log(`  → would archive: ${r._id} (${r.status}) "${r.heading}"`)
    );
    return { moved: eligible.length, errors: 0 };
  }

  // ── 2. Build ArchivedReport documents ─────────────────────────────────────
  let moved  = 0;
  let errors = 0;

  for (const r of eligible) {
    try {
      // Check whether we already archived this report (idempotency guard)
      const alreadyDone = await ArchivedReport.exists({
        originalId: String(r._id),
        purgeYear,
      });

      if (alreadyDone) {
        // Already archived in this cycle – still delete from main collection
        await Report.deleteOne({ _id: r._id });
        console.log(`[annualCleanup] Already archived (idempotent delete): ${r._id}`);
        moved++;
        continue;
      }

      // Create archive document
      await ArchivedReport.create({
        originalId:   String(r._id),
        reportId:     r.reportId   || "",
        email:        r.email      || "",
        heading:      r.heading    || "",
        description:  r.description|| "",
        concern:      r.concern    || "",
        subConcern:   r.subConcern || "",
        otherConcern: r.otherConcern || "",
        building:     r.building   || "",
        otherBuilding:r.otherBuilding || "",
        college:      r.college    || "",
        floor:        r.floor      || "",
        room:         r.room       || "",
        otherRoom:    r.otherRoom  || "",
        image:        r.image      || "",
        ImageFile:    r.ImageFile  || "",
        status:       r.status     || "",
        reporterType: r.reporterType || "Student",
        comments:     r.comments   || [],
        createdAt:    r.createdAt,
        purgedAt:     startedAt,
        purgeYear,
      });

      // Delete from main collection
      await Report.deleteOne({ _id: r._id });

      moved++;
      console.log(`[annualCleanup] Archived & deleted: ${r._id} "${r.heading}"`);
    } catch (err) {
      errors++;
      console.error(`[annualCleanup] ERROR for report ${r._id}:`, err.message);
    }
  }

  const duration = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
  console.log(
    `[annualCleanup] Done in ${duration}s – moved: ${moved}, errors: ${errors}`
  );

  return { moved, errors };
}

/* ============================================================
   CRON SCHEDULER
============================================================ */

/**
 * Register the cron job.
 * Fires at 02:00 AM on July 30 every year.
 *   ┌─────── minute  (0)
 *   │ ┌───── hour    (2)
 *   │ │ ┌─── day     (30)
 *   │ │ │ ┌─ month   (7 = July)
 *   │ │ │ │ ┌ weekday (*)
 *   0 2 30 7 *
 */
function scheduleAnnualCleanup() {
  const DRY_RUN  = process.env.CLEANUP_DRY_RUN   === "true";
  const FORCE    = process.env.CLEANUP_FORCE_NOW  === "true";

  if (FORCE) {
    console.log("[annualCleanup] CLEANUP_FORCE_NOW=true – running immediately.");
    runAnnualCleanup({ dryRun: DRY_RUN }).catch(console.error);
  }

  // Schedule for July 30 at 02:00 AM every year
  cron.schedule("0 2 30 7 *", () => {
    runAnnualCleanup({ dryRun: DRY_RUN }).catch(console.error);
  });

  console.log(
    "[annualCleanup] Scheduled: runs every year on July 30 at 02:00 AM Delete Every Resolved and Archive."
  );
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = { scheduleAnnualCleanup, runAnnualCleanup };