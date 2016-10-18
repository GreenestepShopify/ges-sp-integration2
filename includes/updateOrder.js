var nconf    = require('nconf');
var rollbar = require("rollbar");

exports.updateOrder = function  (infoReturned, rollbar, callback, asyncCallback)
{
	console.log("on update Order: " , infoReturned.shopifyInfo.name)
	callback ("[#"+infoReturned.shopifyInfo.name+"]" , infoReturned['shopifyInfo'].name, asyncCallback);
	/*
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

	var options = { method: 'POST', url: 'https://'+shopkey+':'+shopPassword+'@'+site+'/admin/orders/'+order_id+'/fulfillments.json',
	  headers: { 'cache-control': 'no-cache', 'content-type': 'application/json' },
	  body: { fulfillment: {
	  							tracking_url: tracking_url,
	  							tracking_company: parsedTrackingCompany,
	  							shipping_carrier: parsedTrackingCompany,
	  							tracking_number: tracking_number
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
				callback (messageSent , infoReturned['shopifyInfo'].name , asyncCallback);
			}else{
				// Transaction successful
				console.log( canonicMessage + "Transaction done succesfully, ammount captured." );
				if (messageSent == canonicMessage)
					callback(null , infoReturned['shopifyInfo'].name , asyncCallback);
				else
					callback (messageSent , infoReturned['shopifyInfo'].name, asyncCallback);
			}
		});

	});
	*/
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