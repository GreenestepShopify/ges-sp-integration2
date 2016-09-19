var express = require('express');

var router = express.Router();
var shopifyCtrl = require('../controllers/shopifyController');

router.post('/orderPlaced', shopifyCtrl.orderPlaced)
router.get('/keepAlive', shopifyCtrl.keepAlive)

module.exports = router;