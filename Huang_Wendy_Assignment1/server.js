// Author: Wendy Huang
// Date: 11/10/2023
// My server js file that runs the server for my site. This was taken from our Lab12 with permission from Dan to use it 

const express = require('express');
const app = express();
const products = require(__dirname + "/products.json");
const querystring = require("querystring");

app.use(express.urlencoded({ extended: true }));

// Routing 
// monitor all requests
app.all('*', function (request, response, next) {
    console.log(request.method + ' to path ' + request.path + 'with qs' + JSON.stringify(request.query)) ; 
    next();
});

// process purchase request (validate quantities, check quantity available)
<** your code here ***>

app.post("/process_form", function (request, response) {  let q = request.body['quantity_textbox'];
if (typeof q != 'undefined') {
response.send(`Thank you for purchasing ${q} things!`);
}
 });

app.get('/pro', function (request, response, next) {
    response.send('in route GET to /test');
});

// route all other GET requests to files in public 
app.use(express.static(__dirname + '/public'));


// start server
app.listen(8080, () => console.log(`listening on port 8080`)); // note the use of an anonymous function here to do a callback
