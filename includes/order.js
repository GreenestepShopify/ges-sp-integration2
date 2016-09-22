var nconf    = require('nconf');
var async = require('async');
var CronJob = require('cron').CronJob;
var performRequest = require('./performRequest');

function returnCartItemInfo (sessKey, apiKey, itemcode, quantity, itemAliasCode, measureCode)
{
	var cartItemInfo = `{	key:[ {"API_KEY":"`+apiKey+`","SESSION_KEY": "`+sessKey+`"}],
							data:"{
									'itemCode':'`+itemcode+`',
									'quantity':'`+quantity+`',
									'itemAliasCode':'`+itemAliasCode+`',
									'measureCode':'`+measureCode+`'
								}"
						}`;
	return cartItemInfo;
}

function conditionToTerminate(bodyJSON){
	return  (bodyJSON["DATA"][0] != undefined) &&
			(bodyJSON["DATA"][0].TrackingNumber != null) &&
			(bodyJSON["DATA"][0].TrackingNumber != undefined) &&
			(bodyJSON["DATA"][0].DelivDesc != null) &&
			(bodyJSON["DATA"][0].DelivDesc != undefined);
}

exports.createOrder = function  (infoReturned, rollbar, cb){

	var bodyGetCustomerDetailsJson = JSON.parse( infoReturned["bodyGetCustomerDetails"] );
	var dataElement = bodyGetCustomerDetailsJson["DATA"][1];
	
	// this is the only relevant information, the rest must be hardcoded
	var ShipAddressCode = dataElement.match(/'addressCode':'(.+?)'/)[1];
	var DeliveryMethod = "USPS-REG";
	var PaymentType = 2;
	var PaymentTermCode = "ONCC";
	var FlatShippingCharge = infoReturned['shopifyInfo'].shipping_lines[0].price;

	//console.log ("[#"+infoReturned['shopifyInfo'].name+"][createOrder]Info for creating order: ShipAddressCode: '"+ShipAddressCode+"', DeliveryMethod: '"+DeliveryMethod+"', FlatShippingCharge: '"+FlatShippingCharge+"', PaymentType: '"+PaymentType+"', PaymentTermCode: '" + PaymentTermCode+"'");
	var orderData = `{
						key:[{"API_KEY":"`+infoReturned['API_KEY']+`","SESSION_KEY": "`+infoReturned['SESSION_KEY']+`"}]
						,data:"{'objOrderPrerequisite':{
															'DeliveryDate':'',
															'DeliveryMethod':'` + DeliveryMethod + `',
															'FlatShippingCharge':'` + FlatShippingCharge + `',
															'PaymentType':` + PaymentType + `,
															'PaymentTermCode':'` + PaymentTermCode + `',
															'PaymentMethodTypeCode':'',
															'CardID':0,
															'AVSAddressCode':0,
															'ShipAddressCode':` + ShipAddressCode + `,
															'IsIncludeInsurance':true,
															'IsExistingCard':false,
															'DestinationZoneCode':'',
															'PODate':'',
															'PONumber':'`+infoReturned['shopifyInfo'].name+`',
															'Notes':'',
															'WorldPayTransactionID':'',
															'CVV2Code':'',
															'PaymentCurrency':'USD',
															'AVSAddress':'',
															'ZipCode':'',
															'ExpiryMonthYear':'',
															'SaveThisCard':false,
															'RefNumber':''
														},
														'existingCreditCard':0,
														'CCresult':'',
														'processWebPayment':'1',
														'result':'-1',
														'authAmt':'',
														'payMethodsXML':''
								}"`;

	performRequest.performRequest( infoReturned['shopifyInfo'].name , 'POST','/StoreAPI/WebOrder/CreateOrder',orderData,
		function (body) {
			if ( JSON.parse(body)["DATA"] == undefined ){
				console.log("[#"+infoReturned['shopifyInfo'].name+"][createOrder]CreateOrder error: Greenestep server is sending an empty response. May be some product(s) in the cart are not being displayed on the web store.");
				rollbar.reportMessageWithPayloadData( "[#"+infoReturned['shopifyInfo'].name+"]There was an error creating a new order, Greenestep server is sending an empty response. May be some product(s) in the cart are not being displayed on the web store at greenestep backoffice.",
				{ 	
					level: "error",

					shopifyOrderID: infoReturned['shopifyInfo'].name,
					fingerprint: "$ErrCrtOrdNoResp" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
					shopifyRequest: infoReturned["shopifyInfo"],
					response: body,
					ShipAddressCode: ShipAddressCode,
					DeliveryMethod: DeliveryMethod,
					FlatShippingCharge: FlatShippingCharge,
					PaymentType: PaymentType,
					PaymentTermCode: PaymentTermCode,
					allRequest: orderData
				});
				cb(1,body);
			}else{
				cb(null,body);
			}
		},
		function (body) {
			console.log("[#"+infoReturned['shopifyInfo'].name+"][createOrder]CreateOrder error" );
			rollbar.reportMessageWithPayloadData( "[#"+infoReturned['shopifyInfo'].name+"]There was an error creating a new order with the customer: '"+infoReturned['person']+"'",
				{
					level: "error",
					shopifyOrderID: infoReturned['shopifyInfo'].name,
					fingerprint: "$ErrCrtOrd" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
					shopifyRequest: infoReturned["shopifyInfo"],
					response: body,
					ShipAddressCode: ShipAddressCode,
					DeliveryMethod: DeliveryMethod,
					FlatShippingCharge: FlatShippingCharge,
					PaymentType: PaymentType,
					PaymentTermCode: PaymentTermCode,
					allRequest: orderData
				});
				console.log(body);
				cb(1,body);
		}
	);
}

exports.addItemToCart = function  (infoReturned, rollbar, cb){

	var line_items = infoReturned['shopifyInfo'].line_items;
	var bodyCb = [];
	var cartItemInfo;
	var genericSKU = nconf.get("additionalKeys:genericSKU")
	var usingGenericSku = 0;
	var usingExternVendor = 0;
	//console.log("[#" + infoReturned['shopifyInfo'].name + "]Adding " + line_items.length + " items to cart" );

	async.each(line_items, function(item, callback) {

		if (  item.vendor == nconf.get("additionalKeys:allowedVendor") ){

			// PROCESS ONLY ITEMS FROM FMC VENDOR
			var itemAliasCode = "";
			var measureCode = "";
			cartItemInfo = returnCartItemInfo (infoReturned['SESSION_KEY'], infoReturned['API_KEY'], item.sku, item.quantity, itemAliasCode , measureCode )
			performRequest.performRequest( infoReturned['shopifyInfo'].name , 'POST','/StoreAPI/ShoppingCart/AddItemToCart',cartItemInfo,
				function (body) {
					// ADDED WITH REGULAR SKU
					infoReturned['lineitems'].push( { "id": item.id } );
					bodyCb.push(body);
					callback(null,bodyCb);
				},
				function (body) {
					// COULD NOT ADD ITEM WITH REGULAR SKU
					console.log("[#"+infoReturned['shopifyInfo'].name+"]Could not add an item with regular SKU: " + item.sku );
					rollbar.reportMessageWithPayloadData (
						"[#"+infoReturned['shopifyInfo'].name+"]The product code (SKU): "+item.sku+" was not found on Greenestep server",
						{
							level: "info",
							shopifyOrderID: infoReturned['shopifyInfo'].name,
							fingerprint: "$SkuNotFound" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
							response: body,
							SKU: item.sku,
							allRequest: cartItemInfo
						}
					);

					// TRYING TO ADD ITEM WITH GENERIC SKU
					cartItemInfo = returnCartItemInfo (infoReturned['SESSION_KEY'], infoReturned['API_KEY'], genericSKU, item.quantity, itemAliasCode , measureCode )
					performRequest.performRequest( infoReturned['shopifyInfo'].name , 'POST','/StoreAPI/ShoppingCart/AddItemToCart',cartItemInfo,
						function (body) {
							// ADDED ITEM WITH GENERIC SKU
							usingGenericSku++
							infoReturned['lineitems'].push( { "id": item.id } );
							bodyCb.push(body);
							callback(null,bodyCb);
						},
						function (body) {
							// COULD NOT ADD ITEM WITH GENERIC SKU
							console.log("[#"+infoReturned['shopifyInfo'].name+"]Could not add an item with generic SKU: " + genericSKU );
							rollbar.reportMessageWithPayloadData (
								"[#"+infoReturned['shopifyInfo'].name+"]Could not add item with generic SKU: '" + genericSKU + "'",
								{
									level: "error",
									shopifyOrderID: infoReturned['shopifyInfo'].name,
									fingerprint: "$CantAddGenSKU" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
									response: body,
									SKU: genericSKU,
									allRequest: cartItemInfo
								}
							);
							callback(1,bodyCb);
						}
					);
				}
			);
		}else{
			// OTHER ITEMS VENDORS
			usingExternVendor++
			console.log("[#"+infoReturned['shopifyInfo'].name+"]Filtering item with extern vendor: " + item.vendor );
			rollbar.reportMessageWithPayloadData (
				"[#"+infoReturned['shopifyInfo'].name+"]Item with vendor: " + item.vendor + " was filtered from cart",
				{
					level: "info",
					shopifyOrderID: infoReturned['shopifyInfo'].name,
					fingerprint: "$ExternVendor" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
					vendor: item.vendor,
					allRequest: cartItemInfo
				}
			);
			callback( null , {} )
		}

	}, function(err) {
		if (err) {
  			console.log("[#"+infoReturned['shopifyInfo'].name+"][addItemToCart]An item failed to process on addItemToCart, aborting process.");
			cb(1,bodyCb);
		}else{
			console.log("[#"+infoReturned['shopifyInfo'].name+"][addItemToCart]All items have been added to the cart successfully. ("+usingGenericSku+" with generic SKU: "+genericSKU+", " + usingExternVendor + " were filtered due to its vendor)");
			cb(null,bodyCb);
		}
	});
	
	
}

exports.getShipmentTrackingNos = function  (infoReturned, rollbar, cb){

	var bodyCreateOrder = JSON.parse(infoReturned["bodyCreateOrder"]);
	var OrderNo = bodyCreateOrder["DATA"].OrderNo;
	var docType = 8;
	var trackingOrdersNosInfo = `{	key:[ {"API_KEY":"`+infoReturned['API_KEY']+`","SESSION_KEY": "`+infoReturned['SESSION_KEY']+`"}],
									data:"{
											'orderNo':'`+OrderNo+`',
											'docType':'`+docType+`'
										  }"
								 }`;
	var count = -1;
	var period = -1;
	var job = new CronJob( nconf.get("additionalKeys:interval") , function() {

		count++;
		if (count % 5 == 0)
		{	
			period++;
			console.log("[#"+infoReturned['shopifyInfo'].name+"][getShipmentTrackingNos]Reached period: ", period);
		}

		performRequest.performRequest( infoReturned['shopifyInfo'].name , 'POST','/StoreAPI/WebOrder/GetShipmentTrackingNos',trackingOrdersNosInfo,
			function (body) {
				var bodyJSON = JSON.parse(body);
			  	if (conditionToTerminate(bodyJSON)){
					rollbar.reportMessageWithPayloadData( "[#"+infoReturned['shopifyInfo'].name+"]A new tracking number ('"+bodyJSON["DATA"][0].TrackingNumber+"') was entered for order number: "+OrderNo,
					{
						level: "info",
						fingerprint: "$NewTrkNumb" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
						shopifyOrderID: infoReturned['shopifyInfo'].name,
						OrderNo: OrderNo,
						docType: docType
					});
			  		job.stop();
			  		cb(null,bodyJSON);
				}
			},
			function (body) {
				console.log("[#"+infoReturned['shopifyInfo'].name+"][getShipmentTrackingNos]getShipmentTrackingNos Error.");
				rollbar.reportMessageWithPayloadData( "[#"+infoReturned['shopifyInfo'].name+"]There was an error when obtaining the Tracking number for the order number: " + infoReturned['shopifyInfo'].name,
					{
						level: "error",
						fingerprint: "$ErrTrkNum" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
						shopifyOrderID: infoReturned['shopifyInfo'].name,
						response: body,
						OrderNo: OrderNo,
						docType: docType,
						allRequest: trackingOrdersNosInfo
						
					});
		  		job.stop();
		  		cb(1,body);
			}
		);
	}, null, true, 'America/Los_Angeles');
}
