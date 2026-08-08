/**
 * Shared logic for the Particulars Round 3 migration (collapse 4 groups of
 * same-item/different-size rows into single variant-dropdown rows, then
 * renumber the whole list sequentially). Used by BOTH:
 *   - scripts/migrateParticularsRound3.js (CLI, connects to Mongo itself)
 *   - controllers/superadminController.js's runParticularsMigration (HTTP
 *     endpoint, reuses the already-open connection the running server has)
 * so there is exactly one place this logic lives, not two copies that can
 * drift out of sync.
 *
 * Does not touch the database itself - takes a Settings document (or a
 * plain object with a `.particulars` array) and a `dryRun` flag, and
 * returns a plain-object report plus (if not dryRun) the new particulars
 * array to save. The caller is responsible for actually calling
 * settings.save().
 */
const GROUPS = [
  {
    name: 'Sheets (Size) [rows 1-8]',
    oldNos: ['1', '2', '3', '4', '5', '6', '7', '8'],
    labelMatch: /^3'\d+"?\s*x\s*\d/i,
    newLabel: 'சீட்டு (அளவு)',
    newLabelEn: 'Sheets (Size)',
    variantLabels: [
      '3\'9" x 2\'0"', '3\'0" x 2\'0"', '3\'9" x 1\'6"', '3\'0" x 1\'6"',
      '3\'9" x 1\'3"', '3\'0" x 1\'3"', '3\'9" x 1\'0"', '3\'0" x 1\'0"',
    ],
  },
  {
    name: 'Demolish Machine [rows 25-26]',
    oldNos: ['25', '26'],
    labelMatch: /demolish/i,
    newLabel: 'டெமாலிஷ் மெஷின்',
    newLabelEn: 'Demolish Machine',
    variantLabels: ['Big', 'Small'],
    variantDefaults: { Big: 800, Small: 500 },
  },
  {
    name: 'Wood Machine [rows 33-34]',
    oldNos: ['33', '34'],
    labelMatch: /wood (cutting|router)/i,
    newLabel: 'வுட் மெஷின்',
    newLabelEn: 'Wood Machine',
    variantLabels: ['Cutting Machine', 'Router Machine'],
    variantDefaults: { 'Cutting Machine': 650, 'Router Machine': 650 },
  },
  {
    name: 'Steel [rows 36-41]',
    oldNos: ['36', '37', '38', '39', '40', '41'],
    labelMatch: /^steel/i,
    newLabel: 'ஸ்டீல்',
    newLabelEn: 'Steel',
    variantLabels: ['6mm', '8mm', '10mm', '12mm', '16mm', '20mm'],
  },
];

/**
 * @param {object} settingsDoc - a Mongoose Settings document (must have .particulars)
 * @param {object} DeliveryNoteModel - the DeliveryNote model, for the reference-check report
 * @param {boolean} dryRun
 * @returns {Promise<{ log: string[], changed: boolean, newParticulars: object[] }>}
 */
async function computeParticularsRound3Migration(settingsDoc, DeliveryNoteModel, dryRun) {
  const log = [];
  let working = settingsDoc.particulars.map((p) => (p.toObject ? p.toObject() : { ...p }));
  const removedIdsToReport = [];
  let anyGroupApplied = false;

  for (const group of GROUPS) {
    const matched = working.filter(
      (p) => group.oldNos.includes(p.no) || group.labelMatch.test(p.labelEn || '') || group.labelMatch.test(p.label || '')
    );
    const alreadyCollapsed = matched.length === 1 && matched[0].variants && matched[0].variants.length >= group.variantLabels.length;
    if (matched.length === 0) {
      log.push(`Skip "${group.name}": no matching rows found (already migrated, or never existed on this database).`);
      continue;
    }
    if (alreadyCollapsed) {
      log.push(`Skip "${group.name}": already collapsed into a single variant row.`);
      continue;
    }

    anyGroupApplied = true;
    const variants = group.variantLabels.map((label, i) => {
      const existing = matched[i];
      const perDayRate = existing?.defaultPerDayRate ?? (group.variantDefaults ? group.variantDefaults[label] : 0) ?? 0;
      const rate = existing?.defaultRate ?? 0;
      return { label, rate, perDayRate };
    });

    log.push(`"${group.name}": collapsing ${matched.length} row(s) -> "${group.newLabelEn}"`);
    variants.forEach((v) => log.push(`   ${v.label}: rate=${v.rate} perDayRate=${v.perDayRate}`));

    const minOrder = Math.min(...matched.map((p) => p.order ?? 0));
    const matchedIds = matched.map((p) => String(p._id));
    removedIdsToReport.push(...matchedIds);

    working = working.filter((p) => !matchedIds.includes(String(p._id)));
    working.push({
      no: '',
      label: group.newLabel,
      labelEn: group.newLabelEn,
      defaultRate: 0,
      defaultPerDayRate: 0,
      defaultMonthlyRate: 0,
      order: minOrder,
      variants,
    });
  }

  working.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const renumberLog = [];
  working.forEach((p, i) => {
    const newNo = String(i + 1);
    if (p.no !== newNo) renumberLog.push(`   ${p.labelEn || p.label}: no ${JSON.stringify(p.no)} -> "${newNo}"`);
    p.no = newNo;
    p.order = i + 1;
  });

  log.push('Full renumber (all rows, after collapsing):');
  if (renumberLog.length === 0) {
    log.push('   (no changes - already sequential)');
  } else {
    log.push(...renumberLog);
  }

  if (removedIdsToReport.length && DeliveryNoteModel) {
    const referencingNotes = await DeliveryNoteModel.find({ 'items.particularId': { $in: removedIdsToReport } }).select('noteNumber');
    if (referencingNotes.length) {
      log.push(`${referencingNotes.length} existing delivery note(s) reference a row being removed (unaffected - they keep their own no/itemName snapshot):`);
      referencingNotes.forEach((n) => log.push(`   - ${n.noteNumber}`));
    }
  }

  const changed = anyGroupApplied || renumberLog.length > 0;
  return { log, changed, newParticulars: working };
}

module.exports = { computeParticularsRound3Migration };
