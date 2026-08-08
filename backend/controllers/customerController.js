const Customer = require('../models/Customer');
const DeliveryNote = require('../models/DeliveryNote');
const asyncHandler = require('../utils/asyncHandler');
const { isCloudinaryConfigured, uploadBufferToCloudinary } = require('../config/cloudinary');

// GET /api/customers?search=
const getCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = search
    ? { $or: [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }] }
    : {};
  const customers = await Customer.find(filter).sort({ name: 1 });
  res.json({ success: true, count: customers.length, data: customers });
});

// GET /api/customers/:id
const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  const notes = await DeliveryNote.find({ customer: customer._id }).sort({ date: -1 });
  res.json({ success: true, data: { customer, deliveryNotes: notes } });
});

// POST /api/customers
const createCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.create(req.body);
  res.status(201).json({ success: true, data: customer });
});

// PUT /api/customers/:id
const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  res.json({ success: true, data: customer });
});

// DELETE /api/customers/:id
const deleteCustomer = asyncHandler(async (req, res) => {
  const inUse = await DeliveryNote.exists({ customer: req.params.id });
  if (inUse) {
    res.status(400);
    throw new Error('Cannot delete a customer that has delivery notes on record');
  }
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  res.json({ success: true, data: {} });
});

// POST /api/customers/aadhaar-scan  (multipart, field name "aadhaarPhoto")
// Uploaded before the customer record itself exists yet (during new-customer
// entry on the Create Delivery Note screen) - the frontend gets a Cloudinary
// url/publicId back and includes them as the aadhaarPhoto field's value on
// the subsequent POST /api/customers call, same upload-first-attach-later
// pattern as recordApi.uploadFile / POST /api/records/upload.
const uploadAadhaarScan = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(500);
    throw new Error(
      'Photo storage is not set up yet - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in the backend environment variables.'
    );
  }
  if (!req.file) {
    res.status(400);
    throw new Error('No photo file was received. Attach one under the "aadhaarPhoto" field.');
  }
  const result = await uploadBufferToCloudinary(req.file.buffer, 'name-construction/aadhaar-photos');
  res.status(201).json({
    success: true,
    data: {
      url: result.secure_url,
      publicId: result.public_id,
      uploadedBy: req.user?._id,
      uploadedAt: new Date(),
    },
  });
});

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, uploadAadhaarScan };
