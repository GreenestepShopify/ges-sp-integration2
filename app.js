var express = require('express');
var bodyParser = require('body-parser');
var router = require('./router');
var request = require('request');
var nconf    = require('nconf');
var mongoose = require('mongoose');
var Order = require('./Order');



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
	//mongoose.connect('mongodb://gsuser:greenestep1@ds059306.mlab.com:59306/heroku_9r39zlz9');
	mongoose.connect('mongodb://gsuser:greenestep1@ds059654.mlab.com:59654/heroku_kzt4j2kj');
	//mongodb://gsuser:greenestep1@ds059654.mlab.com:59654/heroku_kzt4j2kj
	setInterval( executeOnInterval , 3000);
})

function executeOnInterval()
{
	Order.find( {status: '2'}, function(err, orders) {
	  if (err) throw err;
	  var k = 0;
	  for (k=0 ; k<orders.length;k++)
		processOrder (orders[k])
	});
	console.log('\n')
}

function processOrder (ord)
{
	console.log(ord.orderId , ord.orderName , ord.status )
	
}