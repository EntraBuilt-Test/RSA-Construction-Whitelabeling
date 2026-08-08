/**
 * Default/fallback Delivery Note Particulars list. This is the SEED value for
 * the database-backed list managed in the Superadmin panel - the live app
 * reads the editable version from GET /api/settings, and only falls back to
 * this file if that request fails (e.g. a network hiccup).
 *
 * Renumbered sequentially (1, 2, 3, ... no gaps) after collapsing several
 * groups of same-item/different-size rows into a single row with a Variant
 * dropdown, the same `variants: [{ label, rate, perDayRate }, ...]`
 * mechanism already used by "Jacky" and "Welding Machine" below. See
 * backend/scripts/migrateParticularsVariants.js for the live-database
 * migration that remaps already-saved delivery note line items (which
 * reference a particular by `no`/label, matched via
 * matchSavedItemToParticular) from the old individual rows to these new
 * collapsed rows + a matching selectedVariant.
 *
 * `label` = Tamil text shown when the UI language is Tamil.
 * `labelEn` = English text shown when the UI language is English.
 */
const STANDARD_PARTICULARS = [
  // Collapsed from the old rows 1-8 (eight separate flat "3'9x2'0 Sheet" ...
  // "3'0x1'0 Sheet" rows) into one row with all eight sizes as variants.
  // Named "Sheets (Size)" rather than plain "Sheets" to avoid colliding
  // with the *different* existing "Sheets" row below (board sizes for
  // Column Box, e.g. 9"x9" - a different product with its own dropdown,
  // linked to the shared Settings sheet-size list). Flag this naming to
  // whoever reviews the printed pad, in case a different label reads
  // better there.
  {
    no: '1',
    label: 'சீட்டு (அளவு)',
    labelEn: 'Sheets (Size)',
    variants: [
      { label: '3\'9" x 2\'0"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 2\'0"', rate: 0, perDayRate: 0 },
      { label: '3\'9" x 1\'6"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 1\'6"', rate: 0, perDayRate: 0 },
      { label: '3\'9" x 1\'3"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 1\'3"', rate: 0, perDayRate: 0 },
      { label: '3\'9" x 1\'0"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 1\'0"', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '2', label: 'கிளாம்பு', labelEn: 'Clamp' },
  {
    no: '3',
    label: 'ஜாக்கி',
    labelEn: 'Jacky',
    variants: [
      { label: '7 Feet', rate: 0, perDayRate: 0 },
      { label: '10 Feet', rate: 0, perDayRate: 0 },
      { label: '20 Feet', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '4', label: 'காலம் ஆணி', labelEn: 'Column Pin/Nail' },
  // Column Box: plain row, no variant dropdown - same shape as row 4
  // "Column Pin/Nail" (Quantity/Rate only). The size-variant dropdown
  // (9"x9", 1'0"x9", ...) lives only on the "Sheets" row below.
  { no: '5', label: 'காலம் பாக்ஸ் (போல்ட் நட் உள்பட)', labelEn: 'Column Box (incl. bolt & nut)' },
  {
    no: '6',
    label: 'சீட்டு',
    labelEn: 'Sheets',
    variantSizeSource: 'settings.sheetSizeOptions',
    variants: [
      { label: '9" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'0" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'3" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'6" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'3" x 1\'0"', rate: 0, perDayRate: 0 },
      { label: '1\'6" x 1\'0"', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '7', label: 'ஜெனரேட்டர்', labelEn: 'Generator', defaultPerDayRate: 1000 },
  { no: '8', label: 'எர்த் வயர்', labelEn: 'Earth Wire' },
  { no: '9', label: 'சப்போர்ட்டிங் (சாரம் போட்டு தரப்படும்)', labelEn: 'Supporting (Scaffolding - provided with support)' },
  { no: '10', label: 'அட்ஜஸ்ட்மெண்ட் Sheet', labelEn: 'Adjustment Sheet' },
  { no: '11', label: 'லிப்டிங் மெஷின் / வைப்ரேட்டர் மெஷின்', labelEn: 'Lifting Machine / Vibrator Machine' },
  { no: '12', label: 'லிப்ட் மெஷின்', labelEn: 'Lift Machine', defaultPerDayRate: 1500, defaultMonthlyRate: 15000 },
  { no: '13', label: 'சுவர் வெட்டும் இயந்திரம் 16 இன்ச்', labelEn: 'Wall Cutter Machine 16inch', defaultPerDayRate: 1500 },
  { no: '14', label: 'எர்த் ரேம்மர்', labelEn: 'Earth Rammer', defaultPerDayRate: 1500 },
  { no: '15', label: 'சாரக்கட்டு', labelEn: 'Sucff holding', defaultRate: 2 },
  // Collapsed from the old rows 25 "Demolish Machine Big" and 26 "...
  // Small" - each size's existing defaultPerDayRate carried over as its
  // variant's perDayRate.
  {
    no: '16',
    label: 'டெமாலிஷ் மெஷின்',
    labelEn: 'Demolish Machine',
    variants: [
      { label: 'Big', rate: 0, perDayRate: 800 },
      { label: 'Small', rate: 0, perDayRate: 500 },
    ],
  },
  {
    no: '17',
    label: 'வெல்டிங் மெஷின்',
    labelEn: 'Welding Machine',
    defaultPerDayRate: 500,
    variants: [
      { label: '200A', rate: 0, perDayRate: 500 },
      { label: '250A', rate: 0, perDayRate: 600 },
      { label: '350A', rate: 0, perDayRate: 800 },
    ],
  },
  { no: '18', label: 'ஹேண்ட் கட்டர்', labelEn: 'Hand Cutter', defaultPerDayRate: 150 },
  {
    no: '19',
    label: 'கோர் கட்டிங்',
    labelEn: 'Core Cutting',
    // Flat per-variant Rate (not Per-Day Rate) - same pattern as Jacky/Sheets.
    // Only 1"/2" are offered; 3"/4" were removed per founder direction.
    variants: [
      { label: '1 inch', rate: 600, perDayRate: 0 },
      { label: '2 inch', rate: 800, perDayRate: 0 },
    ],
  },
  // Collapsed from the old rows 33 "Wood Cutting Machine" and 34 "Wood
  // Router Machine" - both shared the same defaultPerDayRate (650) already.
  {
    no: '20',
    label: 'வுட் மெஷின்',
    labelEn: 'Wood Machine',
    variants: [
      { label: 'Cutting Machine', rate: 0, perDayRate: 650 },
      { label: 'Router Machine', rate: 0, perDayRate: 650 },
    ],
  },
  {
    no: '21',
    label: 'ஜாக்கெட் ஸ்பேன்',
    labelEn: 'Jacket Span',
    variants: [
      { label: '10 Feet', rate: 0, perDayRate: 5 },
      { label: '14 Feet', rate: 0, perDayRate: 8 },
    ],
  },
  // Collapsed from the old rows 36-41 "Steel 6mm" ... "Steel 20mm".
  {
    no: '22',
    label: 'ஸ்டீல்',
    labelEn: 'Steel',
    variants: [
      { label: '6mm', rate: 0, perDayRate: 0 },
      { label: '8mm', rate: 0, perDayRate: 0 },
      { label: '10mm', rate: 0, perDayRate: 0 },
      { label: '12mm', rate: 0, perDayRate: 0 },
      { label: '16mm', rate: 0, perDayRate: 0 },
      { label: '20mm', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '23', label: 'பைண்டிங் வயர்', labelEn: 'Binding Wire' },
];

export const DEFAULT_MATERIAL_CATEGORIES = ['General', 'Structural', 'Equipment Rental', 'Electrical', 'Plumbing'];
export const DEFAULT_MATERIAL_UNITS = ['Bags', 'Tons', 'Nos', 'Ft', 'Kg', 'Ltr'];
// Shared size options for Column Box + Sheets (see variantSizeSource on both rows above).
export const DEFAULT_SHEET_SIZE_OPTIONS = [
  '9" x 9"',
  '1\'0" x 9"',
  '1\'3" x 9"',
  '1\'6" x 9"',
  '1\'3" x 1\'0"',
  '1\'6" x 1\'0"',
];

export default STANDARD_PARTICULARS;
