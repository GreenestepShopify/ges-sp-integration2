var express = require('express');
var bodyParser = require('body-parser');
var router = require('./router');
var request = require('request');
var nconf    = require('nconf');


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
	
	if ( nconf.get("additionalKeys:timeBetweenAutoRequest") != "0"){
		console.log("KeepAlive Interval: " + nconf.get("additionalKeys:timeBetweenAutoRequest") + " ms")
		setInterval( function(){ request('https://ges-sp-integration.herokuapp.com/shopify/keepAlive', null ); }, nconf.get("additionalKeys:timeBetweenAutoRequest") );		
	}

})

