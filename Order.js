// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// create a schema

var Order = new Schema({
  orderId: String,
  orderName: String,
  apiKei: String,
  sessionKey: String,
  orderNumberGreenestep: String,
  carrierId : String,
  status: String
});

// 1= Order placed, 2=OrderCreated in GESOrder, 4 : eliminada

// the schema is useless so far
// we need to create a model using it
var Order = mongoose.model('Order', Order);

// make this available to our users in our Node applications
module.exports = Order;