var express = require('express');
var app = express();

app.all('*', function (request, response, next) {
    console.log(request.method + ' to path ' + request.path + ' query string ' + JSON.stringify(request.query));
    next();
});

app.use(express.urlencoded({ extended: true }));

var products = require('./products.json');

app.get("/product_data.js", function (request, response, next) {
   response.type('.js');
   var products_str = `var products = ${JSON.stringify(products)};`;
   response.send(products_str);
});

app.post("/add_review", function (request, response, next) {
    console.log(request.body);
    var prod_index = Number(request.body.product_reviewed_index);
    if(typeof products[prod_index].reviews == 'undefined' ) {
        products[prod_index].reviews =[];
    }
    products[prod_index].reviews.push({"rating": request.body.star, "comments": request.body.Comments, "date": Date()});

    response.redirect('back');
});

app.use(express.static(__dirname + '/public'));

app.listen(8080, () => console.log(`listening on port 8080`)); // note the use of an anonymous function here to do a callback

