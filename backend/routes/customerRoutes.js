const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { uploadAadhaarPhoto } = require('../middleware/upload');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  uploadAadhaarScan,
} = require('../controllers/customerController');

const router = express.Router();
router.use(protect);

// multer errors (wrong field name, oversized file, etc.) need to reach the
// same JSON error response shape as everything else, hence the explicit
// callback wrapper here rather than passing uploadAadhaarPhoto directly as
// route middleware - identical pattern to the module-file upload route.
const handleAadhaarPhotoUpload = (req, res, next) => {
  uploadAadhaarPhoto(req, res, (err) => {
    if (err) {
      return next(new Error(err.message || 'Aadhaar photo upload failed'));
    }
    next();
  });
};

router.get('/', getCustomers);
// Must be registered before '/:id' so "aadhaar-scan" isn't swallowed by the
// :id param route.
router.post('/aadhaar-scan', handleAadhaarPhotoUpload, uploadAadhaarScan);
router.get('/:id', getCustomer);
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
  ],
  validate,
  createCustomer
);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
