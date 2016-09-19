var shopifyRoutes = require('./routes/shopify');

exports.route = function(app) {
    app.use('/shopify', shopifyRoutes);
};