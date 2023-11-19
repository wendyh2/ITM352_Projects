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

    const errors = {};
    let hasQty = false;
    let hasInput = false;

    for (const i in products) {
        const qty = parseInt(request.body[`quantity${i}`]);

        if (qty > 0) {
            hasQty = true;
            hasInput = true;
        }

        if (qty == "") {
            request.body[`quantity${i}`] = 0;
        }

        if (!findNonNegInt(qty)) {
            errors[`quantity${i}_error`] = findNonNegInt(qty, true).join("<br>");
            hasInput = true;
        }

        if (qty > products[i].quantity_available) {
            errors[`quantity${i}_available_error`] = `We don't have ${qty} available!`;
            hasInput = true;
        }
    }

    if (hasQty === false && hasInput === false) {
        errors[`noQty`] = `Please select some items to purchase!`;
    }

    console.log(errors);

    if (Object.keys(errors).length === 0) {
        for (const i in products) {
            products[i].quantity_available -= request.body[`quantity${i}`];
            products[i].quantity_sold += Number(request.body[`quantity${i}`]);
        }
        response.redirect("./invoice.html?" + querystring.stringify(request.body));
    } else {
        request.body["errorsJSONstring"] = JSON.stringify(errors);
        response.redirect(
            "./products_display.html?" + querystring.stringify(request.body)
        );
        console.log(request.body);
    }
});

// Added HTML table row
app.get("/exampleTableRow", function (request, response, next) {
    const i = 0; // Adjust the index as needed
    const extended_price = 123.45; // Replace with your calculated value
    const product_quantities_array = [1, 2, 3]; // Replace with your data
    response.send(`
        <tr>
            <td style="width: 43%; text-align: left;">
                <img src="./img/${products[i].image}" alt="Product Image" width="50px" height="50px" title="${products[i].description}">
                ${products[i].name}
            </td>
            <td style="width: 11%; text-align: center;">
                ${product_quantities_array[i]}
                <div style="color: red;">
                    ${errors.join('<br>')}
                </div>
            </td>
            <td style="width: 13%; text-align: center;">\$${products[i].price}</td>
            <td style="width: 54%; text-align: center;">\$${extended_price.toFixed(2)}</td>
        </tr>
    `);
});

// Serve static files
app.use(express.static(__dirname + '/public'));

// Start server
app.listen(8080, () => console.log(`listening on port 800`));

function findNonNegInt(q, returnErrors = false) {
    const errors = [];
    if (Number(q) !== q) errors.push("Not a number!");
    if (q < 0) errors.push("Negative value!");
    if (parseInt(q) !== q) errors.push("Not an integer!");

    return returnErrors ? errors : errors.length === 0;
}
