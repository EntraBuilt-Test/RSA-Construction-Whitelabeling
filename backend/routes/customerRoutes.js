const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');

const router = express.Router();
router.use(protect);

router.get('/', getCustomers);
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
