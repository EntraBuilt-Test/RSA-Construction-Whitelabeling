/**
 * PARTICULARS ROUND 3: collapse 4 more groups into variant rows, then
 * renumber the ENTIRE list sequentially (1, 2, 3, ... no gaps). See
 * utils/particularsRound3Migration.js for the actual logic (shared with
 * the superadmin HTTP endpoint - POST /api/superadmin/migrate-particulars-
 * round3 - for anyone who doesn't have shell access to the backend, e.g.
 * Render's free tier doesn't include a Shell tab).
 *
 * Existing Delivery Notes are NOT rewritten, matching the precedent set by
 * migrateParticularVariants.js: DeliveryNote.itemSchema stores its own
 * frozen no/itemName/rate snapshot at save time, so historical notes keep
 * displaying correctly regardless of what the live particulars list looks
 * like afterwards. This only PRINTS which saved notes reference an
 * about-to-be-removed row's old _id, for spot-checking.
 *
 * Usage (from the backend/ folder, needs MONGODB_URI reachable):
 *   node scripts/migrateParticularsRound3.js            # dry run
 *   node scripts/migrateParticularsRound3.js --confirm  # actually writes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const DeliveryNote = require('../models/DeliveryNote');
const { computeParticularsRound3Migration } = require('../utils/particularsRound3Migration');

const CONFIRM = process.argv.includes('--confirm');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const settings = await Settings.findOne({ singleton: 'default' });
  if (!settings) {
    console.log('No Settings document exists yet - nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  console.log('--------------------------------------------------');
  console.log('Particulars Round 3: collapse + full renumber');
  console.log('--------------------------------------------------');

  const { log, changed, newParticulars } = await computeParticularsRound3Migration(settings, DeliveryNote, !CONFIRM);
  log.forEach((line) => console.log(line));
  console.log('--------------------------------------------------');

  if (!changed) {
    console.log('Nothing to do - already fully migrated.');
    await mongoose.disconnect();
    return;
  }

  if (!CONFIRM) {
    console.log('DRY RUN - nothing was changed.');
    console.log('Re-run with --confirm to apply the changes above:');
    console.log('  node scripts/migrateParticularsRound3.js --confirm');
    await mongoose.disconnect();
    return;
  }

  settings.particulars = newParticulars;
  settings.markModified('particulars');
  await settings.save();
  console.log(`Done. Settings document updated - ${newParticulars.length} particulars, renumbered 1-${newParticulars.length}.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
