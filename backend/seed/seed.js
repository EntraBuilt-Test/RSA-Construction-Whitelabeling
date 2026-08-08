/**
 * Seeds the database with a demo user, a few customers, an opening material
 * stock (mirroring the paper ledger examples), and a couple of delivery notes
 * so the app is immediately explorable after setup.
 * Run with: npm run seed  (requires MONGODB_URI to be reachable)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Material = require('../models/Material');
const StockTransaction = require('../models/StockTransaction');
const DeliveryNote = require('../models/DeliveryNote');
const Settings = require('../models/Settings');
const Worker = require('../models/Worker');
const LabourEntry = require('../models/LabourEntry');
const SiteLog = require('../models/SiteLog');
const generateNoteNumber = require('../utils/generateNoteNumber');
const { computeDeliveryNoteTotals, remainingStock } = require('../utils/calc');

// Backend copy of frontend/src/data/standardParticulars.js - the two files can't
// share an ES module, so this list is intentionally duplicated here as the
// one-time seed value for the DB-backed Settings document (Superadmin panel
// takes over editing it after this). Keep these two files in sync if the
// pre-printed pad's wording ever needs correcting before a fresh seed.
const SEED_PARTICULARS = [
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
    variants: [
      { label: '1 inch', rate: 600, perDayRate: 0 },
      { label: '2 inch', rate: 800, perDayRate: 0 },
    ],
  },
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
const SEED_MATERIAL_CATEGORIES = ['General', 'Structural', 'Equipment Rental', 'Electrical', 'Plumbing'];
const SEED_MATERIAL_UNITS = ['Bags', 'Tons', 'Nos', 'Ft', 'Kg', 'Ltr'];
const SEED_SITES = ['Thanjavur Site', 'Trichy Road Site', 'N.K. Road Site'];
// Flat list (not grouped by category) - matches how materialCategories/materialUnits
// are already stored, and the Brand datalist in MaterialEntryForm isn't
// filtered by category today.
const SEED_MATERIAL_BRANDS = ['Tata', 'Amman', 'Aditya', 'Shyam', 'Dalmia', 'UltraTech', 'Arasu', 'JSW'];
// Shared size list for Column Box + Sheets (see variantSizeSource on both
// rows above) - same 6 labels Column Box already used before it was linked.
const SEED_SHEET_SIZE_OPTIONS = [
  '9" x 9"',
  '1\'0" x 9"',
  '1\'3" x 9"',
  '1\'6" x 9"',
  '1\'3" x 1\'0"',
  '1\'6" x 1\'0"',
];
const SEED_WORKER_ROLES = [
  'Labour (Male)',
  'Labour (Female)',
  'Carpenter',
  'Electrical',
  'Tiles Layer',
  'False Ceiling Labour',
  'Mason',
  'Centering – Fitter',
  'Centering – Helper',
  'Welder',
  'Electrician',
  'Plumber',
  'Vendor',
  'Kamatchi Concrete',
  'Other',
];

async function seed() {
  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    Material.deleteMany({}),
    StockTransaction.deleteMany({}),
    DeliveryNote.deleteMany({}),
    Settings.deleteMany({}),
    Worker.deleteMany({}),
    LabourEntry.deleteMany({}),
    SiteLog.deleteMany({}),
  ]);

  console.log('Creating admin user (Superadmin-enabled)...');
  await User.create({
    name: 'Billvortex Admin',
    email: 'admin@billvortex.com',
    password: 'Admin@123',
    role: 'admin',
    isSuperAdmin: true,
  });

  console.log('Seeding Settings (Delivery Note particulars + Material categories/units + Sites)...');
  await Settings.create({
    singleton: 'default',
    particulars: SEED_PARTICULARS.map((p, idx) => ({
      no: p.no,
      label: p.label,
      labelEn: p.labelEn,
      defaultRate: p.defaultRate || 0,
      defaultPerDayRate: p.defaultPerDayRate || 0,
      defaultMonthlyRate: p.defaultMonthlyRate || 0,
      order: idx,
      variants: p.variants || [],
      variantSizeSource: p.variantSizeSource || '',
    })),
    materialCategories: SEED_MATERIAL_CATEGORIES,
    materialUnits: SEED_MATERIAL_UNITS,
    sites: SEED_SITES,
    materialBrands: SEED_MATERIAL_BRANDS,
    workerRoles: SEED_WORKER_ROLES,
    sheetSizeOptions: SEED_SHEET_SIZE_OPTIONS,
  });

  console.log('Creating customers...');
  const [c1, c2] = await Customer.create([
    { name: 'Kalyana Sundaram', phone: '9876543210', address: 'Ramco, Thanjavur' },
    { name: 'Subramani', phone: '9944556677', address: 'M.Kovil, Thanjavur' },
  ]);

  console.log('Creating opening material stock (per spec example: Steel 500 / Cement 100)...');
  const materialsData = [
    { materialName: 'Steel', category: 'Structural', unit: 'Nos', openingStock: 500, reorderLevel: 100, purchaseRate: 68 },
    { materialName: 'Cement', category: 'General', unit: 'Bags', openingStock: 100, reorderLevel: 20, purchaseRate: 380 },
    { materialName: '7 Adi Jack', category: 'Equipment Rental', unit: 'Nos', openingStock: 15, reorderLevel: 3, purchaseRate: 3270 },
    { materialName: '10 Adi Jack', category: 'Equipment Rental', unit: 'Nos', openingStock: 12, reorderLevel: 3, purchaseRate: 3919 },
  ];
  const materials = [];
  for (const m of materialsData) {
    const material = await Material.create({
      ...m,
      quantityPurchased: 0,
      quantityUsed: 0,
      remainingStock: m.openingStock,
      totalAmount: 0,
      supplier: 'Opening Balance',
    });
    materials.push(material);
    await StockTransaction.create({
      materialId: material._id,
      type: 'IN',
      quantity: m.openingStock,
      rate: m.purchaseRate,
      balanceAfter: m.openingStock,
      reference: 'Opening Stock',
      referenceType: 'Manual',
      remarks: 'Initial balance loaded during setup',
    });
  }
  const steel = materials[0];

  console.log('Creating a demo delivery note (auto-deducts Steel stock, matching the spec example)...');
  const items = [
    { itemName: 'Steel', quantity: 85, rate: 68, materialId: steel._id },
    { itemName: '3\'9"x2\'0" Shuttering', quantity: 23, rate: 150 },
  ];
  const { items: computedItems, totalAmount } = computeDeliveryNoteTotals(items);
  const noteNumber = await generateNoteNumber();
  const note = await DeliveryNote.create({
    noteNumber,
    date: new Date(),
    customer: c1._id,
    customerNameSnapshot: c1.name,
    customerPhoneSnapshot: c1.phone,
    customerAddressSnapshot: c1.address,
    vehicleNumber: 'TN49CH8736',
    items: computedItems,
    totalAmount,
    paymentStatus: 'Pending',
    stockDeducted: true,
  });

  steel.quantityUsed += 85;
  steel.remainingStock = remainingStock(steel.openingStock, steel.quantityPurchased, steel.quantityUsed);
  await steel.save();

  await StockTransaction.create({
    materialId: steel._id,
    type: 'OUT',
    quantity: 85,
    rate: 68,
    balanceAfter: steel.remainingStock,
    reference: note.noteNumber,
    referenceType: 'DeliveryNote',
    remarks: 'Auto-deducted on delivery note creation',
  });

  console.log('Creating demo workers...');
  const [w1, w2, w3] = await Worker.create([
    { name: 'Karthik', site: 'Thanjavur Site', role: 'Mason', dailyWage: 800, openingBalance: 1500, currentBalance: 1500 },
    { name: 'Murugan', site: 'Thanjavur Site', role: 'Labour', dailyWage: 600, openingBalance: 0, currentBalance: 0 },
    { name: 'Senthil', site: 'Trichy Road Site', role: 'Helper', dailyWage: 500, openingBalance: 500, currentBalance: 500 },
  ]);

  console.log('Creating demo daily entries (LabourEntry)...');
  
  // Karthik worked 3 days, got 500 advance, 1000 paid.
  // wageEarned = 800 * 3 = 2400
  // balanceAfter = 1500 + 2400 - 500 - 1000 = 2400
  const e1 = await LabourEntry.create({
    workerId: w1._id,
    workerName: w1.name,
    site: w1.site,
    role: w1.role,
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    daysWorked: 3,
    wageRate: w1.dailyWage,
    wageEarned: 2400,
    advance: 500,
    paid: 1000,
    balanceAfter: 2400,
    remarks: 'Regular week entry',
  });
  w1.currentBalance = 2400;
  await w1.save();

  // Murugan worked 2.5 days, 0 advance, 1200 paid.
  // wageEarned = 600 * 2.5 = 1500
  // balanceAfter = 0 + 1500 - 1200 = 300
  const e2 = await LabourEntry.create({
    workerId: w2._id,
    workerName: w2.name,
    site: w2.site,
    role: w2.role,
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    daysWorked: 2.5,
    wageRate: w2.dailyWage,
    wageEarned: 1500,
    advance: 0,
    paid: 1200,
    balanceAfter: 300,
    remarks: 'Partial week',
  });
  w2.currentBalance = 300;
  await w2.save();

  // Senthil worked 4 days, 200 advance, 1800 paid.
  // wageEarned = 500 * 4 = 2000
  // balanceAfter = 500 + 2000 - 200 - 1800 = 500
  const e3 = await LabourEntry.create({
    workerId: w3._id,
    workerName: w3.name,
    site: w3.site,
    role: w3.role,
    date: new Date(),
    daysWorked: 4,
    wageRate: w3.dailyWage,
    wageEarned: 2000,
    advance: 200,
    paid: 1800,
    balanceAfter: 500,
    remarks: 'Weekly settlement',
  });
  w3.currentBalance = 500;
  await w3.save();

  console.log('\nSeed complete.');
  console.log('Login with: admin@name.com / Admin@123 (Superadmin-enabled)');
  console.log(`Steel remaining stock: ${steel.remainingStock} (500 opening - 85 used = 415, per spec example)`);
}

module.exports = { seed };

if (require.main === module) {
  (async () => {
    await connectDB();
    await seed();
    await mongoose.disconnect();
  })().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
