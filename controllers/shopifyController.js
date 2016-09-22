var nconf    = require('nconf');
var async = require('async');
var customer = require('../includes/customer');
var loginRequest = require('../includes/loginRequest');
var order = require('../includes/order');
var functions = require('../includes/functions');
var rollbar = require("rollbar");
var request = require('request');

// this will be used for storing temporarily processed transaction id's
var processed = [];

function existsCustomerInformation (data){
	return (functions.getCountry(data) &&
			functions.getZip(data) &&
			functions.getProvince_code(data) &&
			functions.getCity(data) &&
			functions.getPhone(data) &&
			functions.getAddress1(data) &&
			functions.getCustomeremail(data) &&
			functions.getCustomerName(data))
}

function shippingInfoPresent (data){
	return ((data.shipping_lines != undefined) &&
			(data.shipping_lines != null) &&
			(data.shipping_lines[0] != undefined) &&
			(data.shipping_lines[0] != null))
}

function canContinue(data){
	var msj = null;
	if ( !shippingInfoPresent (data) )
		msj = "["+data.name+"]Error: No shipping information provided from Shopify."

	if ( !existsCustomerInformation (data) )
		msj = "["+data.name+"]Error: No customer information provided from Shopify."
	return msj;
}

// EXPORTED METHODS

exports.keepAlive = function (req, res) {
	res.json({ code: 200, message: "" });
	return;
}

exports.orderPlaced = function (req, res) {

	// Response to shopify before process
	res.json({ code: 200, message: "" });
	
	// Setup initial information
	rollbar.init(nconf.get("keys:rollbarKey"));
	var infoReturned = { API_KEY : "" , SESSION_KEY : "" ,
		bodySaveCustomer : "" , bodyShoppingCartLogin : "" ,
		bodyCreateOrder : "", bodyAddItemToCart : "",
		bodyGetCustomerDetails : "", bodyGetShipmentTrackingNos : "",
		shopifyInfo: req.body,
		userexists: false,
		loggedin: false,
		person: "",
		lineitems: []
	}

	// Code for preventing multiple execution
	if (processed[infoReturned['shopifyInfo'].name] ) return;	
	processed[infoReturned['shopifyInfo'].name] = true;

	// reporting to rollbar all the shopify request
	console.log("[#"+infoReturned['shopifyInfo'].name+"]Executing orderPlaced with order: '" + infoReturned['shopifyInfo'].name + "'");
	rollbar.reportMessageWithPayloadData(
		"[#" + infoReturned['shopifyInfo'].name + "]Executing process with a new order",
		{
			level: "info",
			fingerprint: "$NewOrd_" + infoReturned['shopifyInfo'].name + "@ " + infoReturned['shopifyInfo'].id.toString(),
			shopifyRequest: infoReturned["shopifyInfo"]
		}
	);

	// check if all data is correct
	var ErrMsg = canContinue(infoReturned.shopifyInfo);	
	if ( !ErrMsg ){

		var loginSync = function(done){
			loginRequest.loginGS(infoReturned["shopifyInfo"] , rollbar, 
				function(err , api_key , session_key)
				{
					if (!err){
						infoReturned['API_KEY'] = api_key;
						infoReturned['SESSION_KEY'] = session_key;
					}
					done(err);
				}
			);
		}

		var ShoppingCartLoginSync = function(done){
		   loginRequest.ShoppingCartLogin (infoReturned, rollbar,
			    function(err, body, existence, loggedin, person){
			    	infoReturned['userexists'] = existence;
			    	infoReturned['loggedin'] = loggedin;
			    	infoReturned['bodyShoppingCartLogin'] = body;
			    	infoReturned['person'] = person;
			    	done(err);
			    },
				infoReturned.userexists,
				infoReturned.loggedin
		   );
		}

		var saveCustomerSync = function(done){
		   customer.saveCustomer (infoReturned, rollbar, 
			    function(err,body, existence, loggedin){
			    	infoReturned['userexists'] = existence;
			    	infoReturned['loggedin'] = loggedin;
			    	infoReturned['bodySaveCustomer'] = body;
			    	done(err);
			    },
			    infoReturned.userexists,
			    infoReturned.loggedin
		   );
		}


		var getCustomerDetailsSync = function(done){
		   customer.getCustomerDetails (infoReturned, rollbar,
			    function(err,body){
			    	infoReturned['bodyGetCustomerDetails'] = body;
			    	done(err);
			    }
		   );
		}

		var addItemToCartSync = function(done){
		   order.addItemToCart (infoReturned, rollbar,
			    function(err,body){
			    	infoReturned['bodyAddItemToCart'] = body;
			    	done(err);
			    }
		   );
		}

		var createOrderSync = function(done){
		   order.createOrder (infoReturned, rollbar,
			    function(err,body){
			    	infoReturned['bodyCreateOrder'] = body;
			    	done(err);
			    }
		   );
		}

		var getShipmentTrackingNosSync = function(done){
		   order.getShipmentTrackingNos (infoReturned, rollbar,
			    function(err,body){
			    	infoReturned['bodyGetShipmentTrackingNos'] = body;
			    	done(err);
			    }
		   );
		}

		var updateOrderSync = function(done){
			updateOrder(infoReturned, rollbar,
				function (err){
					if (err) console.log(err);
			    	done(err);
				});
		}

		async.waterfall([ 	loginSync ,
							ShoppingCartLoginSync,
							saveCustomerSync,
							ShoppingCartLoginSync,
							getCustomerDetailsSync,
							addItemToCartSync,
							createOrderSync,
							getShipmentTrackingNosSync,
							updateOrderSync
						],
			function(err)
			{
				if (err)
					console.log("[#"+infoReturned['shopifyInfo'].name+"]Process finished with errors.");
				else
					console.log("[#"+infoReturned['shopifyInfo'].name+"]Process finished successfully.");
			}
		)

		
	}else{
		var missingInfo = ErrMsg.match('customer') ? "customer information from Shopify." : "shipping information from Shopify." 
		console.log("[#" + infoReturned['shopifyInfo'].name + "]" + ErrMsg + ".\nAborting.");
		rollbar.reportMessageWithPayloadData( "[#" + infoReturned['shopifyInfo'].name + "]Missing " + missingInfo + "." ,
		{
			level: "error",
			shopifyOrderID: infoReturned['shopifyInfo'].name,
			fingerprint: "$MissInfo_" + infoReturned['shopifyInfo'].name + "@ " + infoReturned['shopifyInfo'].id.toString(),
			message: "[# " + infoReturned['shopifyInfo'].name + "] " + ErrMsg,
			allRequest : infoReturned['shopifyInfo']
		});
	}

}

function translateCarrier(DelivDesc)
{
	var carr = "Other"
	var DelivDescToParse = DelivDesc.toLowerCase().replace(/\s/g, "");
	if ( DelivDescToParse.match("UPS Next Day Air Early AM".toLowerCase().replace(/\s/g, "") ) )
		carr = "USPS-REG"
	else if ( DelivDescToParse.match("United States Postal Service".toLowerCase().replace(/\s/g, "") ) )
		carr = "USPS";
	else if ( DelivDescToParse.match("UPS".toLowerCase().replace(/\s/g, "") ) )
		carr = "UPS";
	else if ( DelivDescToParse.match("FedEx".toLowerCase().replace(/\s/g, "") ) )
		carr = "FedEx";
	return carr;
}


function updateOrder(infoReturned, rollbar, callback) {
	
	var shopname = nconf.get("additionalKeys:shopName");
	var shopkey = nconf.get("keys:shopifyKey");
	var shopPassword = nconf.get("keys:shopifyPassword");
	var site = nconf.get("Places:PurchaseSite");
	var order_id = infoReturned.shopifyInfo.id;
	var tracking_number = infoReturned['bodyGetShipmentTrackingNos']["DATA"][0].TrackingNumber;
	var tracking_company = infoReturned['shopifyInfo'].shipping_lines[0].carrier_identifier;
	var tracking_url = infoReturned['bodyGetShipmentTrackingNos']["DATA"][0].TrackUrl;
	var tracking_delivery_date = infoReturned['bodyGetShipmentTrackingNos']["DATA"][0].DeliveryDate;
	var tracking_note = infoReturned['bodyGetShipmentTrackingNos']["DATA"][0].Note;
	var parsedTrackingCompany = translateCarrier(infoReturned['bodyGetShipmentTrackingNos']["DATA"][0].DelivDesc);

	console.log ("[#"+infoReturned.shopifyInfo.name+"]Tacking number received. Using keys: ShopName: '"+shopname+"', ShopKey: '"+shopkey+"', ShopPassword: '"+shopPassword+"'" );
	console.log ("[#"+infoReturned.shopifyInfo.name+"]Trying to create a fulfillment: order: '"+order_id+"', tracking Number: '"+tracking_number+"', tracking company: '"+parsedTrackingCompany+"'.");



	console.log ( "Trying to fulfil items: " + infoReturned.lineitems.map( function(elem){ return elem.id } ))

	var options = { method: 'POST', url: 'https://'+shopkey+':'+shopPassword+'@'+site+'/admin/orders/'+order_id+'/fulfillments.json',
	  headers: { 'cache-control': 'no-cache', 'content-type': 'application/json' },
	  body: { fulfillment: {
	  							tracking_url: tracking_url,
	  							tracking_company: parsedTrackingCompany,
	  							shipping_carrier: parsedTrackingCompany,
	  							tracking_number: tracking_number,
	  							line_items : infoReturned.lineitems
	  						}
	  		},
	  json: true
	};

	// Making requests to shopify
	var request = require('request');
	var canonicMessage = "[#"+infoReturned.shopifyInfo.name+"]"
	var messageSent = canonicMessage;
	request(options, function (error, response, body) {
		if (error)
		{
			// Fulfillment error
			messageSent += "Fulfillment Error, please check rollbar.\n"
			console.log ( canonicMessage + "Fulfillment Error" );
			rollbar.reportMessageWithPayloadData
			(	"[#"+infoReturned['shopifyInfo'].name+"]Could not fulfill order" ,
				{
					level: "error",
					error: error,
					fingerprint: "$NoFillfil_" + infoReturned['shopifyInfo'].name + "@ " + infoReturned['shopifyInfo'].id.toString(),
					response: response,
					body: body,
					tracking_number: tracking_number,
					tracking_url: tracking_url,
					tracking_company: tracking_company,
					shipping_carrier: tracking_company
				}
			);

		}else // Fulfillment successful
			console.log(canonicMessage + "Fulfillment created succesfully");

		var transactionKind = "capture";
		var optionsTransaction = { method: 'POST', url: 'https://'+shopkey+':'+shopPassword+'@'+site+'/admin/orders/'+order_id+'/transactions.json',
		  	headers:  { 'cache-control': 'no-cache', 'content-type': 'application/json' },
		  	body: { transaction: { kind: transactionKind } },
		   	json: true
		};

		// Try to capture funds
		request(optionsTransaction, function (error, response, body) {
			if (error)
			{
				// Transaction error
				messageSent += "Transaction Error, please check rollbar.\n"
				console.log ( canonicMessage + "Transaction Error" );
				rollbar.reportMessageWithPayloadData
				(
					"[#"+infoReturned['shopifyInfo'].name+"]Transaction Error, could not capture funds.",
					{
						level: "error",
						error: error,
						fingerprint: "$TransErr_" + infoReturned['shopifyInfo'].name + "@ " + infoReturned['shopifyInfo'].id.toString(),
						response: response,
						body: body,
						shopifyOrderID: infoReturned['shopifyInfo'].name,
						amount: infoReturned['shopifyInfo'].total_price,
						kind: transactionKind
					}
				);
				callback (messageSent);
			}else{
				// Transaction successful
				console.log( canonicMessage + "Transaction done succesfully, ammount captured." );
				if (messageSent == canonicMessage)
					callback(null);
				else
					callback (messageSent);
			}
		});

	});
	
	
}
