// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// create a schema
order_id infoReturned.shopifyInfo.id;
var orderSchema = new Schema({
  orderId: String,
  orderName: String,
  status: String
});

// 1= Order placed, 2=OrderCreated in GES

// the schema is useless so far
// we need to create a model using it
var Order = mongoose.model('Order', orderSchema);

// make this available to our users in our Node applications
module.exports = Order;