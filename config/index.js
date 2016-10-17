/*jshint node:true */
"use strict";

var path = require('path');
var nconf = require('nconf');

module.exports = function(env) {
    env = env || 'default';

    try {
        nconf.file('environment', path.join(__dirname, '/env/', env + '.json'));
        nconf.file('default', path.join(__dirname, '/env/default.json'));
    }
    catch (e) {
    	console.log( "Exception @ nconf: " , e.message );
        return null;
    }
    
    overrideFromEnv('MONGODB_URI', "additionalKeys:mongodb_uri" );
    


    return nconf;
};



function overrideFromEnv(envKey, nconfKey) {
  if (process.env[envKey]) {
    nconf.set(nconfKey, process.env[envKey]);
  }
}
