// Author: Wendy Huang
// Date: 11/10/2023
// My server js file that runs the server for my site. This was taken from our Lab12 with permission from Dan to use it

const express = require('express');
const app = express();
const querystring = require('querystring');
const products = require(__dirname + '/products.json');

// Middleware for decoding form data
app.use(express.urlencoded({ extended: true }));

// Log all requests
app.all('*', function (request, response, next) {
    console.log(request.method + ' to ' + request.path);
    next();
});

// Route to provide products data as a JavaScript file
app.get("/products_data.js", function (request, response, next) {
    response.type('.js');
    const products_str = `var products = ${JSON.stringify(products)}`;
    response.send(products_str);
});

// Process purchase request
app.post("/purchase", function (request, response, next) {
    console.log(request.body);

    // validate quantities
    const errors = {}; //assume no errors at start
    let hasQty = false; // assuming user did not select any valid quantities/products
    let hasInput = false; 
    // validates data and loops it through our array in products.json file 
    for (let i in products) {
        const qty = request.body[`quantity${i}`];

        // Did the user select any products? 
        if (qty > 0) {
            hasQty = true; //If they had quantity selected then 
            hasInput = true;
        }
        //If they didn't have anything on the quantity box then assume they didn't select anything and put it as 0 
        if (qty == "") {
            request.body[`quantity${i}`] = 0;
        }
        //Validates the quantity and if it was a non-negative integer 
        if (findNonNegInt(qty) === false) {
            errors[`quantity${i}_error`] = findNonNegInt(qty, true).join("<br>");
            hasInput = true;
        }
        // If the quantity selevcted is greater than the products available then send back an error 
        if (qty > products[i].sets_available) {
            errors[`quantity${i}_error`] = `We don't have ${qty} available!`;
            hasInput = true;
        }
    }
    // If the there were no qunatities input then send back an error
    if (hasQty === false) {
        errors[`noQty`] = `Please select some items to purchase!`;
    }

    console.log(errors);
    // A loop, so when theres no errors at all the customers are send into the invoice 
    if (Object.keys(errors).length === 0) {
        // When the purchase is valid this will reduce our inventory by the amounts purchased
        for (const i in products) {
            products[i].sets_available -= Number(request.body[`quantity${i}`]);
            products[i].quantity_sold += Number(request.body[`quantity${i}`]);
        }
        // This redirects them to the invoice with a querystring that has the values they wanted and they've been removed from the inventory
        response.redirect("./invoice.html?" + querystring.stringify(request.body));
    } else { // This is if there were errors we wend them back to the products display and are notified of the problems 
        response.redirect(
            "./products_display.html?" + querystring.stringify(request.body) + "&" + querystring.stringify(errors) 
        ); //We will be redirected to either a invoice page with the data we input if there are errors then we will be redirected to our products display with the errors we found
        console.log(request.body);
    }
});

// Serve static files
app.use(express.static(__dirname + '/public'));

// Start server
app.listen(8080, () => console.log(`listening on port 8080`));

function findNonNegInt(q, returnErrors = false) {
    const errors = [];
    if (Number(q) != q) errors.push("Not a number!");
    if (q < 0) errors.push("Negative value!");
    if (parseInt(q) != q) errors.push("Not an integer!");

    return returnErrors ? errors : errors.length === 0;
}
