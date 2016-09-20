var nconf    = require('nconf');
var performRequest = require('./performRequest');
var functions = require('./functions');
 
exports.saveCustomer = function  (infoReturned, rollbar, cb, existence){

	if (!existence){
		
		var pass = nconf.get("keys:ShoppingCartLoginPassword");
		var Cname = functions.getCustomerName (infoReturned['shopifyInfo'])
		var Cemail = functions.getCustomeremail (infoReturned['shopifyInfo'])
		var fn = Cname.match(/^(.+?)\s/) ? Cname.match(/^(.+?)\s/)[1] : '';
		var ln = Cname.match(/\s(.+?)$/) ? Cname.match(/\s(.+?)$/)[1] : '';
		var address1 = functions.getAddress1 (infoReturned['shopifyInfo'])
		var phone = functions.getPhone (infoReturned['shopifyInfo'])
		var city = functions.getCity (infoReturned['shopifyInfo'])
		var provCode = functions.getProvince_code (infoReturned['shopifyInfo']) 
		var zip = functions.getZip (infoReturned['shopifyInfo']) 
		var country = functions.getCountry (infoReturned['shopifyInfo'])
		var company = functions.getCompany (infoReturned['shopifyInfo'])
		var customerNotes = functions.getCustomerNote (infoReturned['shopifyInfo'])

		var customerData = `{
			key: [{ "API_KEY": "`+infoReturned['API_KEY']+`",
					"SESSION_KEY": "`+infoReturned['SESSION_KEY']+`"}],
			data:"{
					'oCustomer':{
									'Active':null,
									'CustCode':'`+ Cemail +`',
									'Name':'`+ Cname +`',
									'CustomerNotes':'`+ customerNotes +`',
									'SourceCode':'',
									'PONumberRequired':null,
									'DefaultContCode':0,
									'ShippingAddrCount':0,
									'ContactAddrCount':0,
									'BillingAddressRecord':{
														'Active':null,
														'AddressCode':0,
														'CustCode':'`+ Cemail +`',
														'Password':'`+ pass +`',
														'CompanyName':'`+ company +`',
														'FirstName':'`+ fn +`',
														'LastName':'`+ ln +`',
														'FirstLast':null,
														'Street':'`+ address1 +`',
														'Email':'`+ Cemail +`',
														'SubType':'2',
														'Telephone':'`+ phone +`',
														'Telephone2':null,
														'Fax':'',
														'City':'`+ city +`',
														'State':'`+ provCode +`',
														'Zip':'`+ zip +`',
														'Country':'`+ country +`',
														'SecretQuestion':'',
														'SecretAnswer':'',
														'Residence':'F',
														'AddressType':0,
														'IsAddressUsed':false,
														'FullAddress':'`+ address1 +`',
														'MobilePhone':null
													},
													'ShippingAddressRecords':[],
													'ContactAddressRecords':[]
									},
									'isNew':'1',
									'regisError':'',
									'arrCustSurvey':'[]'
								}"
				}`;

		
		performRequest.performRequest( infoReturned['shopifyInfo'].name , 'POST','/StoreAPI/AccountMngmnt/SaveCustomer',customerData,
			function (body) {
				rollbar.reportMessageWithPayloadData( "[#"+infoReturned['shopifyInfo'].name+"][saveCustomer]The new customer ("+customer.email+") was created successfully",
				{
					level: "info",
					shopifyOrderID: infoReturned['shopifyInfo'].name,
					fingerprint: "$SaveCustOK_" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
					customer: infoReturned['shopifyInfo'].customer,
					password: pass,
					allRequest: customerData
				});
				console.log("[#"+infoReturned['shopifyInfo'].name+"][saveCustomer]saveCustomer Success");
				cb(null,body,true,false);
			},
			function (body) {
				rollbar.reportMessageWithPayloadData( "[#"+infoReturned['shopifyInfo'].name+"][saveCustomer]There was an error creating the new customer ("+customer.email+")",
					{
						level: "error",
						shopifyOrderID: infoReturned['shopifyInfo'].name,
						fingerprint: "$ErrSaveCust" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
						response: body,
						customer: infoReturned['shopifyInfo'].customer,
						password: pass,
						allRequest: customerData
					});
				console.log("[#"+infoReturned['shopifyInfo'].name+"][saveCustomer]saveCustomer Error");
				cb(1,body,false,false);
			}
		);
	}else
		cb(null, infoReturned['bodySaveCustomer'] , true, true);

}

exports.getCustomerDetails = function  (infoReturned, rollbar, cb){

	var bodyShoppingCartLoginJson = JSON.parse(infoReturned["bodyShoppingCartLogin"]);
	var custCode = bodyShoppingCartLoginJson["DATA"][0][0].CUST_CODE;
	var customerDetailsData =  `{
									key:[{ "API_KEY": "`+infoReturned['API_KEY']+`", "SESSION_KEY": "`+infoReturned['SESSION_KEY']+`" }],
									data: "{'custCode':'`+custCode+`','isNew':''}"
								}`;

	performRequest.performRequest( infoReturned['shopifyInfo'].name , 'POST','/StoreAPI/AccountMngmnt/GetCustomerDetails',customerDetailsData,
		function (body) {
			cb(null,body);
		},
		function (body) {
			console.log("[#"+infoReturned['shopifyInfo'].name+"][getCustomerDetails]getCustomerDetails Error");
			rollbar.reportMessageWithPayloadData( "[#"+infoReturned['shopifyInfo'].name+"]There was an error when getting the details for the customer: '"+infoReturned['person']+"'.",
			{
				level: "error",
				shopifyOrderID: infoReturned['shopifyInfo'].name,
				fingerprint: "$ErrGtCustDtl" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
				response: body,
				custCode: custCode,
				loginName: infoReturned['person'],
				allRequest: customerDetailsData
			});
			cb(1,body);
		}
	);

}
