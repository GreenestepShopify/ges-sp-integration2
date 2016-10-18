var express = require('express');
var bodyParser = require('body-parser');
var router = require('./router');
var request = require('request');
var nconf    = require('nconf');
var mongoose = require('mongoose');
var Order = require('./Order');
var CronJob = require('cron').CronJob;
var rollbar = require("rollbar");
var updateOrder = require('./includes/updateOrder');
var performRequest = require('./includes/performRequest');
var async = require('async');
var constants = require('./includes/constants.js');

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
	console.log("Using URI: " ,  nconf.get("additionalKeys:mongodb_uri"))
	mongoose.connect(nconf.get("additionalKeys:mongodb_uri"))
	var job = new CronJob( nconf.get("additionalKeys:interval") , executeOnInterval, null, true, 'America/Los_Angeles');
})

function executeOnInterval()
{
	console.log("interval1: " , constants.constants)
	console.log("interval: " , constants.ORDER_CREATED )
	Order.find( {status: constants.ORDER_CREATED }, function(err, orders) {
	  if (err) console.log("err on interval: " , err);
	  
		async.each(orders, function(currentOrder, callback) {
			processOrder (currentOrder, function(error){ callback(error) } )
		}, function(err) {
			if (err) {
	  			console.log("error on async process")
			}
		});
	});
}

function processOrder (order, asyncCallback)
{
	console.log("process")
	getTrackingNumbers(order.orderName, order.orderId, order.orderNumberGreenestep, order.apiKey, order.sessionKey,
		
		function (err,bodyGetShippingTrackingNumbers){
			if (!err)
			{
				var infoReturned =
				{
					shopifyInfo : {
									id: order.orderId,
									name: order.orderName,
									shipping_lines: [ { carrier_identifier : order.carrierId } ]
								  },
					bodyGetShipmentTrackingNos : bodyGetShippingTrackingNumbers
				}
				rollbar.init(nconf.get("keys:rollbarKey"));
				updateOrder.updateOrder(infoReturned, rollbar, updateCallback, asyncCallback )		
			}else{
				console.log("Error when trying to get Tracking number on GES: order: ", order.orderId)
				asyncCallback(err)
			}

		} , asyncCallback)
}

function updateCallback(err, oname, asyncCallback)
{
	if (err){
		console.log(err);
		asyncCallback(null)
	}else{
		Order.findOneAndUpdate( { orderName: oname }, { status: STATUS.FINISHED } , function(err, order) {
		  if (err) {
		  	console.log( "On updateCallbackError: " , err );
		  	asyncCallback(null)
		  }else{
		  	console.log("Process finished successfully");
		  	asyncCallback(null)
		  }
		  
		});
	}
}


function getTrackingNumbers(orderName, orderId, orderNumberGreenestep, apiKey, sessionKey, cb, asyncCallback)
{
	console.log("getTRNOS")
	var docType = 8;
	var trackingOrdersNosInfo = `{	key:[ {"API_KEY":"`+apiKey+`","SESSION_KEY": "`+sessionKey+`"}],
									data:"{
											'orderNo':'`+orderNumberGreenestep+`',
											'docType':'`+docType+`'
										  }"
								 }`;

		performRequest.performRequest( orderName , 'POST','/StoreAPI/WebOrder/GetShipmentTrackingNos',trackingOrdersNosInfo,
			function (body) {
				var bodyJSON = JSON.parse(body);
			  	if (conditionToTerminate(bodyJSON)){
					rollbar.reportMessageWithPayloadData( "[#"+orderName+"]A new tracking number ('"+bodyJSON["DATA"][0].TrackingNumber+"') was entered for order number: "+orderNumberGreenestep,
					{
						level: "info",
						fingerprint: "$NewTrkNumb" + orderName + "@" + orderId.toString(),
						shopifyOrderID: orderName,
						OrderNo: orderNumberGreenestep,
						docType: docType
					});
			  		cb(null,bodyJSON,asyncCallback);
				}
			},
			function (body) {
				console.log("[#"+orderName+"][getShipmentTrackingNos]getShipmentTrackingNos Error.");
				rollbar.reportMessageWithPayloadData( "[#"+orderName+"]There was an error when obtaining the Tracking number for the order number: " + orderName,
					{
						level: "error",
						fingerprint: "$ErrTrkNum" + orderName + "@" + orderId.toString(),
						shopifyOrderID: orderName,
						response: body,
						OrderNo: orderNumberGreenestep,
						docType: docType,
						allRequest: trackingOrdersNosInfo
						
					});
		  		cb(1,body, asyncCallback);
			}
		);
}

function conditionToTerminate(bodyJSON){
	return  (bodyJSON["DATA"][0] != undefined) &&
			(bodyJSON["DATA"][0].TrackingNumber != null) &&
			(bodyJSON["DATA"][0].TrackingNumber != undefined) &&
			(bodyJSON["DATA"][0].DelivDesc != null) &&
			(bodyJSON["DATA"][0].DelivDesc != undefined);
}