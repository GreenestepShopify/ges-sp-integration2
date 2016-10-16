var express = require('express');
var bodyParser = require('body-parser');
var router = require('./router');
var request = require('request');
var nconf    = require('nconf');
var mongoose = require('mongoose');
var Order = require('../includes/orderSchema');



if ( process.env.NODE_ENV === undefined ) {
	process.env.NODE_ENV = 'default';
}
console.log("App Environment: "+process.env.NODE_ENV);
require('./config/index')(process.env.NODE_ENV);

// Create app
var app = express();

// App config
app.set('port', process.env.PORT || 3000);

// parse application/json
app.use(bodyParser.json())

app.use(function (req, res, next) {
    next()
})

// Register routes
router.route(app)

//Start sever
app.listen(app.get('port'), function() {
    console.log('Server listening on process ' + process.pid + " and port " + app.get('port'));
	
	mongoose.connect('mongodb://gsuser:greenestep1@ds059306.mlab.com:59306/heroku_9r39zlz9');

	
	var ord1 = new Order({
		  orderId: "Sample",
		  orderName: "SampleName",
		  status: "1"
	});

	ord1.save(function(err) {
	  if (err) throw err;

	  console.log('ord1 saved successfully!');
	});

	
})

