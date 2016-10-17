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
	console.log("URI: " , nconf.get("additionalKeys:mongodb_uri"))
	mongoose.connect(nconf.get("additionalKeys:mongodb_uri"))
	//mongoose.connect('mongodb://gsuser:greenestep1@ds059654.mlab.com:59654/heroku_kzt4j2kj');
	//mongodb://gsuser:greenestep1@ds059654.mlab.com:59654/heroku_kzt4j2kj
	
	var job = new CronJob( nconf.get("additionalKeys:interval") , executeOnInterval, null, true, 'America/Los_Angeles');
})

function executeOnInterval()
{
	Order.find( {status: '2'}, function(err, orders) {
	  if (err) throw err;
	  var k = 0;
	  for (k=0 ; k<orders.length;k++)
		processOrder (orders[k])
	});
}

function processOrder (order)
{
	// infoReturned['shopifyInfo'].shipping_lines[0].carrier_identifier;
	getTRNumbers(order.orderName, order.orderId, order.orderNumberGreenestep, order.apiKei, order.sessionKey,
		
		function (err,bodyGetShTrNos){
			if ( !err  )
			{
				var infoReturned =
				{
					shopifyInfo : {
									id: order.orderId,
									name: order.orderName,
									shipping_lines: [ { carrier_identifier : order.carrierId } ]
								  },
					bodyGetShipmentTrackingNos : bodyGetShTrNos
				}
				rollbar.init(nconf.get("keys:rollbarKey"));
				updateOrder(infoReturned, rollbar, updateCallback )		
			}

		})
}

function updateCallback(err, oname)
{
	if (err)
	{
		console.log(err);
	
	}else{
		Order.findOneAndUpdate( { orderName: oname }, { status: "4" } , function(err, user) {
		  if (err) throw err;

		  // we have the updated user returned to us
		  console.log(user);
		});
	}
}


function getTRNumbers(orderName, orderId, orderNumberGreenestep, apiKey, sessionKey, cb)
{

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
			  		cb(null,bodyJSON);
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
		  		cb(1,body);
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