var nconf    = require('nconf');
var performRequest = require('./performRequest');
var functions = require('./functions');
var MAX_TRY_NUMBER = 5;

function tryLogin ( shopifyInfo, data , tryn, rollbar, callback )
{
	if (tryn == MAX_TRY_NUMBER) {
		callback( "ERROR" , "" , "" )
		return;
	}
	
	var firstMessage = "[#" + shopifyInfo.name + "][" + tryn + "]Using Company: " + data.gesCompany + " -> ";
	performRequest.performRequestLogin( shopifyInfo.name , "POST" , "/StoreAPI/GesApp/GesLogin",data,
		function (body) {
			var bodyJson = JSON.parse(body);
			if ( functions.dataIsFilled (bodyJson['KEY'][0]['API_KEY']) && functions.dataIsFilled (bodyJson['KEY'][0]['SESSION_KEY']) )
			{
				if ( tryn > 1 ) // at least 1 failed attempt
					rollbar.reportMessageWithPayloadData( "[" + shopifyInfo.name + "][loginGS]Login to GES successful after "+tryn+" attempts.", { 	level: "info", fingerprint: "$InfGesLog_" + shopifyInfo.name + "@" + shopifyInfo.id.toString(), response: body, dataSent: data });
				console.log( firstMessage + "Login Successful." );
				callback( null , bodyJson['KEY'][0]['API_KEY'] , bodyJson['KEY'][0]['SESSION_KEY'] );
			}
			else
				tryLogin( shopifyInfo, data , tryn + 1 , rollbar, callback )
		},
		function (body) {
			console.log( firstMessage + "Login Error.");
			if ( tryn == 1 )
			{
				// report error just one time, keep trying ...
				rollbar.reportMessageWithPayloadData( "[" + shopifyInfo.name + "][loginGS]There was an error with the login in Greenestep Company", { level: "error", fingerprint: "$ErrGesLog_" + shopifyInfo.name + "@" + shopifyInfo.id.toString(), response: body, dataSent: data });
			}
			tryLogin( shopifyInfo, data , tryn + 1 , rollbar, callback )
		}
	);
}




exports.loginGS = function(shopifyInfo, rollbar , cb) {
	var data = 	{
			gesCompany: nconf.get("GesLogin:GesLoginCompany"),
			gesLocation: 'HQ',
			gesJuris: 'NY',
			gesPass: nconf.get("GesLogin:GesLoginPassword"),
			gesUser: nconf.get("GesLogin:GesLoginUsername"),
			gesVer: '7.0.100.00000.00000',
			gesWebsitePref: 'DEF',
			localHost: 'WEBSRV',
			productType: '8'
	};
	var tryn = 1;
	tryLogin ( shopifyInfo, data , tryn, rollbar, cb )
}

exports.ShoppingCartLogin = function( infoReturned, rollbar , cb, existence, loggedin ) {

	if (!loggedin){
		// user is not logged in to cart
		var loginName = functions.getCustomeremail (infoReturned['shopifyInfo'])
		var loginPassword = nconf.get("keys:ShoppingCartLoginPassword");

		var dataSent = `{ key: [{ "API_KEY": "`+infoReturned['API_KEY']+`", "SESSION_KEY": "`+infoReturned['SESSION_KEY']+`"}], data: "{	
			    						'login':'`+loginName+`', 'pwd':'`+loginPassword+`'
			    				   }" }`;
		
		performRequest.performRequest( infoReturned['shopifyInfo'].name , "POST","/StoreAPI/AccountMngmnt/ShoppingCartLogin",dataSent,
			function (body) {
				var bodyJson = JSON.parse(body);
				if ( bodyJson["DATA"][0].length == 0 ){
					existence = loggedin = false;					
					console.log( "[#" + infoReturned['shopifyInfo'].name + "]" + "ShoppingCartLogin Successful" + " -> Customer does not exist" );
				}else{
					existence = loggedin = true;
					console.log( "[#" + infoReturned['shopifyInfo'].name + "]" + "ShoppingCartLogin Successful" + " -> Customer found" );
				}
				cb(null,body, existence, loggedin, loginName );
			},
			function (body) {
				console.log("[#" + infoReturned['shopifyInfo'].name + "]" + "ShoppingCartLogin Error");
				rollbar.reportMessageWithPayloadData( "[#" + infoReturned['shopifyInfo'].name + "][ShoppingCartLogin]There was an error logging into the cart with: '"+loginName+"'",
				{
					level: "error",
					fingerprint: "$ErrShpCrtLog" + infoReturned['shopifyInfo'].name + "@" + infoReturned['shopifyInfo'].id.toString(),
					shopifyOrderID: infoReturned['shopifyInfo'].name,
					response: body,
					API_KEY: infoReturned['API_KEY'],
					SESSION_KEY: infoReturned['SESSION_KEY'],
					loginName: loginName,
					loginPassword: loginPassword
				});
				existence = loggedin = false;
				cb(1,body, existence, loggedin, "");
			}
		);

	}else
		cb( null, infoReturned['bodyShoppingCartLogin'] , existence, loggedin, "");
}
