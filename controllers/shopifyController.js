var nconf    = require('nconf');
var async = require('async');
var customer = require('../includes/customer');
var loginRequest = require('../includes/loginRequest');
var order = require('../includes/order');
var functions = require('../includes/functions');
var constants = require('../includes/constants.js');
var rollbar = require("rollbar");
var request = require('request');
var Order = require('../Order');
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

	//console.log(req.body)
	//infoReturned["shopifyInfo"] = sampleOrder();
 

 	//console.log(infoReturned["shopifyInfo"])
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

		var newOrder = Order({
		  orderId: infoReturned['shopifyInfo'].id,
		  orderName: infoReturned['shopifyInfo'].name,
		  carrierId : infoReturned['shopifyInfo'].shipping_lines[0].carrier_identifier,
		  status: ORDER_PLACED
		});


		// Save the order
		var cont = false
		newOrder.save(function(err) {
		  	if (err) console.log(err)
		  	
		});

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
							createOrderSync
						],
			function(err) { if (err) console.log(err) }
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

function sampleOrder()
{
	var ord = 
{ id: 4477401676,
   email: 'shopify+test001@logoworks.com',
   closed_at: null,
   created_at: '2016-10-17T14:48:37-04:00',
   updated_at: '2016-10-17T14:48:38-04:00',
   number: 914,
   note: '',
   token: 'e54eaa0fa06fb721e6f5af6c52607797',
   gateway: 'shopify_payments',
   test: false,
   total_price: '95.49',
   subtotal_price: '79.95',
   total_weight: 454,
   total_tax: '7.59',
   taxes_included: false,
   currency: 'USD',
   financial_status: 'authorized',
   confirmed: true,
   total_discounts: '0.00',
   total_line_items_price: '79.95',
   cart_token: 'aebd75411070fc545bd82a93f4345e26',
   buyer_accepts_marketing: true,
   name: 'FM1914',
   referring_site: 'https://franklin-mint-coins.myshopify.com/admin/orders/4424212172',
   landing_site: '/collections/entertainment/star-trek',
   cancelled_at: null,
   cancel_reason: null,
   total_price_usd: '95.49',
   checkout_token: '663fbbecfd5bd9094dd2870f2d8b9f5d',
   reference: null,
   user_id: null,
   location_id: null,
   source_identifier: null,
   source_url: null,
   processed_at: '2016-10-17T14:48:37-04:00',
   device_id: null,
   browser_ip: '201.217.143.194',
   landing_site_ref: null,
   order_number: 1914,
   discount_codes: [],
   note_attributes: [],
   payment_gateway_names: [ 'shopify_payments' ],
   processing_method: 'direct',
   checkout_id: 12409666764,
   source_name: 'web',
   fulfillment_status: null,
   tax_lines:
    [ { title: 'NY State Tax', price: '3.52', rate: 0.04 },
      { title: 'Nassau County Tax', price: '4.07', rate: 0.04625 } ],
   tags: '',
   contact_email: 'shopify+test001@logoworks.com',
   order_status_url: 'https://checkout.shopify.com/9234676/checkouts/663fbbecfd5bd9094dd2870f2d8b9f5d/thank_you_token?key=c61a0c35b0b138ee7449bcc751925f50',
   line_items:
    [ { id: 8907593868,
        variant_id: 24230593414,
        title: '"Star Trek" 7PC Bridge Collection - Colorized JFK Half Dollars',
        quantity: 1,
        price: '79.95',
        grams: 454,
        sku: 'FM1172',
        variant_title: '',
        vendor: 'Franklin Mint Coins',
        fulfillment_service: 'manual',
        product_id: 7565985606,
        requires_shipping: true,
        taxable: true,
        gift_card: false,
        name: '"Star Trek" 7PC Bridge Collection - Colorized JFK Half Dollars',
        variant_inventory_management: null,
        properties: [],
        product_exists: true,
        fulfillable_quantity: 1,
        total_discount: '0.00',
        fulfillment_status: null
         } ],
   shipping_lines:
    [ { id: 3733236236,
        title: 'Standard Shipping',
        price: '7.95',
        code: 'Standard Shipping',
        source: 'shopify',
        phone: null,
        requested_fulfillment_service_id: null,
        delivery_category: null,
        carrier_identifier: null, } ],
   billing_address:
    { first_name: 'Toufan',
      address1: '67 5th Ave',
      phone: '+1.646.844.9998',
      city: 'Lawrence',
      zip: '11559',
      province: 'New York',
      country: 'United States',
      last_name: 'Rahimpour',
      address2: 'Apt4',
      company: 'CompanySTh',
      latitude: 40.6246237,
      longitude: -73.72933549999999,
      name: 'Toufan Rahimpour',
      country_code: 'US',
      province_code: 'NY' },
   shipping_address:
    { first_name: 'Toufan',
      address1: '67 5th Ave',
      phone: '+1.646.844.9998',
      city: 'Lawrence',
      zip: '11559',
      province: 'New York',
      country: 'United States',
      last_name: 'Rahimpour',
      address2: 'Apt4',
      company: 'CompanySTh',
      latitude: 40.6246237,
      longitude: -73.72933549999999,
      name: 'Toufan Rahimpour',
      country_code: 'US',
      province_code: 'NY' },
   fulfillments: [],
   client_details:
    { browser_ip: '201.217.143.194',
      accept_language: 'en-US,en;q=0.5',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:48.0) Gecko/20100101 Firefox/48.0',
      session_hash: '63f781586ba85bfbfce2e70e237a7da1',
      browser_width: 1349,
      browser_height: 659 },
   refunds: [],
   payment_details:
    { credit_card_bin: '374372',
      avs_result_code: 'Z',
      cvv_result_code: 'M',
      credit_card_number: '•••• •••• •••• 5939',
      credit_card_company: 'American Express' },
   customer:
    { id: 4312410758,
      email: 'shopify+test001@logoworks.com',
      accepts_marketing: true,
      created_at: '2016-08-16T14:56:33-04:00',
      updated_at: '2016-10-17T14:48:37-04:00',
      first_name: 'Toufan',
      last_name: 'Rahimpour',
      orders_count: 54,
      state: 'enabled',
      total_spent: '95.49',
      last_order_id: 4477401676,
      note: null,
      verified_email: true,
      multipass_identifier: null,
      tax_exempt: false,
      tags: '',
      last_order_name: 'FM1914',
      default_address:
       { id: 5015512268,
         first_name: 'Toufan',
         last_name: 'Rahimpour',
         company: 'CompanySTh',
         address1: '67 5th Ave',
         address2: 'Apt4',
         city: 'Lawrence',
         province: 'New York',
         country: 'United States',
         zip: '11559',
         phone: '+1.646.844.9998',
         name: 'Toufan Rahimpour',
         province_code: 'NY',
         country_code: 'US',
         country_name: 'United States',
         default: true } } }

    return ord;
}