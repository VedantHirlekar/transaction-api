const mongoose = require('mongoose');

const productTransactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  productId: { type: String, required: true },
  productTitle: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  dateOfSale: { type: Date, required: true },
});

const ProductTransaction = mongoose.model('ProductTransaction', productTransactionSchema);

module.exports = ProductTransaction;
