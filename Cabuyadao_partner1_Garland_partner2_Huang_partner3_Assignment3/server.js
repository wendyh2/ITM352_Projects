// Author: Wendy Huang
// Date: 11/10/2023
// My server js file that runs the server for my site. This was taken from our Lab12 with permission from Dan to use it

// Updating main

const express = require('express');
const app = express();
const querystring = require('querystring');
const all_products = require(__dirname + '/products.json');
const all_users = require(__dirname + "/user_registration_info.json");
const fs = require("fs");
const cookieParser = require('cookie-parser');
app.use(cookieParser());
app.use(express.json());
const path = require('path');
const nodemailer = require("nodemailer");

const session = require('express-session');


//session 
app.use(session({
    secret: "YourSecretKey",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // set max cookie age for 24 hours so it does not stay and cause issues in the long term. 
}));



// Use crypto library to encrypt password
const crypto = require('crypto');

// Keep track of the number of users currently logged in to the site and display this number with the personalization information.
// This is the global array variable
const loggedInUsers = {};

// Admin middleware to check if the user is an admin
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Access Denied' });
    }
}

function hashPassword(password) {
    //We use any secret key of our choosing, here we use test.
    const secret = 'test';
    // Create hashed password, code referenced from ChatGPT
    const hash = crypto.createHmac('sha256', secret).update(password).digest('hex');
    return hash;
}


// We use user_registration_info.json to hold users registration data (name, password, email)
var filename = __dirname + "/user_registration_info.json";

if (fs.existsSync(filename)) {
    // Read user_registration_info data and save it as variable
    var user_registration_info_obj_JSON = fs.readFileSync(filename, "utf-8");

    // Convert user_registration_info to object
    var user_registration_info = JSON.parse(user_registration_info_obj_JSON);
    // Function to check if a user is an admin
    function isAdmin(username) {
        // Assuming user_registration_info contains a field 'role' for each user
        return user_registration_info[username] && user_registration_info[username].role === 'admin';
    }


    // If file is not found
} else {
    console.log(`File ${filename} was not found!`);
}
// Middleware for decoding form data
app.use(express.urlencoded({ extended: true }));

// Log all requests
app.all('*', function (request, response, next) {
    // if user does not have cart in session, set it up for them here **empty cart**
    if (typeof request.session.cart === 'undefined') {
        request.session.cart = {};
    }
    console.log(request.method + ' to ' + request.path);
    const referringUrl = request.get('referer') || request.get('referrer'); // Referer header may be spelled with or without an "r"

    // IR1: If user came from another server, send them to the last product page they were on if they have one
    if((referringUrl === undefined ||  referringUrl.includes(request.hostname) === false) && request.session.lastProductPage && request.url.includes(request.session.lastProductPage) === false) {
        response.redirect(`.${request.session.lastProductPage}`);
    } else {
        next(); 
    }

});

// Route to provide products data as a JavaScript file
app.get("/products_data.js", function (request, response, next) {
    response.type('.js');
    const products_str = `let all_products = ${JSON.stringify(all_products)}`;
    response.send(products_str);
});

app.get("/user_data.js", function (request, response, next) {
    response.type('.js');
    const user_str = `let all_users = ${JSON.stringify(all_users)}`;
    response.send(user_str);
})

// Route interecpt going to a product page and save the last product page they were on
app.get("/products_display.html", function (request, response, next) {
    request.session.lastProductPage = request.originalUrl;
    next();
});

//  IR1: save the page user is on login 
app.get("/login.html", function (request, response, next) {
    const referringUrl = request.get('referer') || request.get('referrer');
    if(referringUrl.includes('login') === false) {
        request.session.currentPage = referringUrl;
    }
    next();
});

app.get("/registration.html", function (request, response, next) {
    const referringUrl = request.get('referer') || request.get('referrer');
    if(referringUrl.includes('registration') === false) {
        request.session.currentPage = referringUrl;
    }
    next();
});
    

// Route to provide reviews for a product
app.post("/add_review", function (request, response, next) {
    console.log(request.body);
    var prod_index = Number(request.body.product_reviewed_index);
    let prod_key = request.body.product_reviewed_key;
    if (typeof all_products[prod_key][prod_index].reviews === 'undefined') {
        all_products[prod_key][prod_index].reviews = [];
    }
    all_products[prod_key][prod_index].reviews.push({ "rating": Number(request.body.star), "comments": request.body.Comments, "date": Date() });

    response.send(`<script>alert("Thank you for your review! Click ok to go back to the products page.");location.href ='./products_display.html?product_type=${prod_key}';</script>`);
});

// Route to provide cart data as a JavaScript file
app.get("/get_cart.js", function (request, response) {
    response.type('.js');
    const cart_str = `let cart = ${JSON.stringify(request.session.cart)}`;
    response.send(cart_str);
});

// Route to provide service to give sessions current shopping cart data, a microservice
app.post("/cart_data", function (request, response, next) {
    response.type('json');
    response.send(JSON.stringify(request.session.cart));
});

// Route for getting number of logged in users
app.get('/getLoggedInUsers.js', (request, response) => {
    // We just used the same code as products_data.js but modified it for numLoggedInUsers
    response.type('.js');
    // We create an array of logged-in usernames
    const loggedInUsernames = Object.keys(loggedInUsers);
    const numLoggedInUsers = `const numLoggedInUsers = ${loggedInUsernames.length}`;
    response.send(numLoggedInUsers);
})

// Check if an object is empty, code referenced from chatGPT
function isEmpty(obj) {
    // Check if the object is null or undefined first
    if (obj == null || typeof obj === 'undefined') {
        return true;
    }

    // Then check if the object has any keys
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

// Process purchase request rem to change to add cart
app.post("/purchase", function (request, response, next) {
    let prod_key = request.body.product_type;
    let products = all_products[prod_key];
    // validate quantities
    const errors = {}; //assume no errors at start
    let hasQty = false; // assuming user did not select any valid quantities/products
    let hasInput = false;
    // validates data and loops it through our array in products.json file 
    for (let i in products) {
        const qty = request.body[`quantity${i}`];

        // Check if no quantities were selected - code from Assignment 1
        // Did the user select any products? 
        if (qty > 0) {
            hasQty = true; //If they had quantity selected then 
            hasInput = true;
        }
        //If they didn't have anything on the quantity box then assume they didn't select anything and put it as 0 
        if (qty == "") {
            request.body[`quantity${i}`] = 0;
        }
        // Check if a non-negative integer is input as a quantity - code from Assignment 1
        //Validates the quantity and if it was a non-negative integer 
        if (findNonNegInt(qty) === false) {
            errors[`quantity${i}_error`] = findNonNegInt(qty, true).join("<br>");
            hasInput = true;
        }
        // Check if a quantity input for an item exceeds the quantity available for that item - code from Assignment 1
        // Check that quantity entered does not exceed the quantity available on server - code from Assignment 1
        // If the quantity selected is greater than the products available then send back an error
        if (qty > products[i].sets_available) {
            errors[`quantity${i}_exceeds_error`] = `We don't have ${qty} available!`;
            hasInput = true;
        }
    }
    // If the there were no qunatities input then send back an error
    if (hasQty === false) {
        errors[`noQty`] = `Please select some items to purchase!`;
    }

    // A loop, so when theres no errors at all the customers are send into the invoice 
    if (Object.keys(errors).length === 0) {
        // add users selections to cart **SESSIONS**

        // Set prod_key to be the product_type which is the different nail collections
        let prod_key = request.body.product_type;

        // If cart is empty, fill it with values 
        if (isEmpty(request.session.cart)) {
            // Get the products of the collection we selected
            let products = all_products[prod_key];
            // Initialize quantities object
            let quantities = {};

            // Fill the quantities object with values from our request body
            for (let i in products) {
                quantities[`quantity${i}`] = request.body[`quantity${i}`];
            }

            // Add quantities to our session cart
            request.session.cart[prod_key] = quantities;

            response.redirect("./products_display.html?" + querystring.stringify(request.body));
            return
            // If cart already has items in it, adjust quantities if adding more of same items 
        } else {
            // This is to check the collection, the prod_key can be empty if we already have
            // another collection added and chose a new collection
            if (isEmpty(request.session.cart[prod_key])) {
                // Get the products of the collection we selected
                let products = all_products[prod_key];
                // Initialize quantities object
                let quantities = {};

                // Fill the quantities object with values from our request body
                for (let i in products) {
                    quantities[`quantity${i}`] = request.body[`quantity${i}`];
                }

                // Add quantities to our session cart
                request.session.cart[prod_key] = quantities;

                response.redirect("./products_display.html?" + querystring.stringify(request.body));
                return
                // Update quantities if we already have some quantities of the same collection selected
            } else {
                // Get the products of the collection we selected
                let products = all_products[prod_key];
                // Initialize quantities object
                let quantities = {};

                // Add our request body quantities to our existing cart quantities
                for (let i in products) {
                    quantities[`quantity${i}`] = Number(request.body[`quantity${i}`]) + Number(request.session.cart[prod_key][`quantity${i}`]);
                }

                // Update session cart
                request.session.cart[prod_key] = quantities;
                response.redirect("./products_display.html?" + querystring.stringify(request.body));
                return
            }
        }
    } else {
    }
    response.redirect(
        "./products_display.html?" + querystring.stringify(request.body) + "&" + querystring.stringify(errors)
    ); //We will be redirected to either a invoice page with the data we input if there are errors then we will be redirected to our products display with the errors we found
    console.log(request.body);
}
);


// Login route, this is a post request and processes username and password against data in user_registration_info.json
app.post("/login", function (request, response, next) {
    // Initialize empty errors
    const errors = {};

    let username = request.body["username"].toLowerCase();
    let password = request.body["password"];

    // Check if username exists in user_registration_info
    if (user_registration_info.hasOwnProperty(username)) {
        if (hashPassword(password) !== user_registration_info[username].password) {
            errors[`password_error`] = "Password is incorrect.";
        }
    } else {
        errors[`username_error`] = `${username} is not a registered email.`;
    }

    // If all the login information is valid
    if (Object.keys(errors).length === 0) {
        let name = user_registration_info[username].name;

        // Set session user and admin status (if applicable)
        request.session.user = username;
        request.session.isAdmin = user_registration_info[username].role === 'admin';

        // IR4 - Keep track of the number of times a user logged in and the last time they logged in. 
        user_registration_info[username].loginCount = (user_registration_info[username].loginCount || 0) + 1;
        user_registration_info[username].lastLoginDate = new Date().getTime();

        // Update the user info in loggedInUsers for IR5 add 
        loggedInUsers[username] = true;

        // Save the updated user_registration_info
        fs.writeFileSync(filename, JSON.stringify(user_registration_info, null, 2));

        // Send a user info cookie to indicate they're logged in
        response.cookie("userinfo", JSON.stringify({ "email": username, "full_name": name }), { expire: Date.now() + 30 * 1000 });

        // Create params variable and add username and name fields
        let params = new URLSearchParams();
        params.append("loginCount", user_registration_info[username].loginCount);
        params.append("lastLogin", user_registration_info[username].lastLoginDate);

        // Redirect to precvious page for all users
        response.redirect(request.session.currentPage || "./products_display.html?" + params.toString() );
    } else {
        // If login information is invalid, redirects to login page and gives error
        let params = new URLSearchParams(request.body);
        params.append("username", username);
        params.append("errorString", JSON.stringify(errors));
        // Redirect to login.html with new params values
        response.redirect("./login.html?" + params.toString());
    }
});




// Register route, this is a post request and is referenced from the Assignment 2 example code.
app.post("/register", function (request, response, next) {
    // Set variables from request.body
    var username = request.body["username"].toLowerCase();
    var password = request.body["password"];
    var confirmPassword = request.body["confirmPassword"];
    var name = request.body["name"];

    // Initialize empty errors
    var errors = {};

    // Initialize different error types with empty arrays
    errors["username"] = [];
    errors["name"] = [];
    errors["password"] = [];
    errors["confirmPassword"] = [];

    // Checks if username is blank
    if (username == "") {
        errors["username"].push("Please enter an email address.");

        // Checks format of username to see if it is a valid email address, regex referenced from ChatGPT
    } else if (!/^[a-zA-Z0-9._]+@[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$/.test(username)) {
        errors["username"].push("Please enter a valid email address!");

        // Checks if the email is already in our user_registration_info.json file
    } else if (typeof user_registration_info[username] != "undefined") {
        errors["username"].push(`${username} is already registered. Please use a different email address.`);
    }

    // Check if name is blank
    if (name == "") {
        errors["name"].push("Please enter a name (First and Last).");

        // Check if name is in valid First space Last name format, regex referenced from ChatGPT
    } else if (!/^[a-zA-Z]+\s+[a-zA-Z]+$/.test(name)) {
        errors["name"].push("Please enter a first and last name separated by a space.");

        // Check if name is proper length (2 > name.length < 30)
    } else if (name.length > 30 || name.length < 2) {
        errors["name"].push("Please enter a name greater than 2 characters and less than 30 characters.");
    }

    // Check if password is blank
    if (password == "") {
        errors["password"].push("Please enter a password.");

        // Check if password contains spaces, regex referenced from ChatGPT
    } else if (!/^\S+$/.test(password)) {
        errors["password"].push("Password cannot have spaces. Please try again.");

        // Require that passwords have at least one number and one special character, regex referenced from ChatGPT
    } else if (!/^(?=.*\d)(?=.*\W).+$/.test(password)) {
        errors["password"].push("Password must contain at least one letter, one number, and one special character.");

        // Check if confirm password is empty
    } else if (confirmPassword == "") {
        errors["confirmPassword"].push("Please confirm your password.");

        // Check if password and confirm password match
    } else if (password !== confirmPassword) {
        errors["confirmPassword"].push("Passwords do not match.");
    }

    // Check if password is correct length (10 <= password.length <= 16)
    if ((password.length < 10 && password.length >= 1) || password.length > 16) {
        errors["password"].push("Password length must be between 10 and 16 characters.");
    }

    // Check count of errors, if 0 then we redirect user to invoice.html else there are errors and redirect to registration page
    var countErrors = 0;

    // Loop through errors
    for (var error in errors) {
        countErrors += errors[error].length;
    }

    // If there are no errors, we redirect to invoice.html 
    if (countErrors === 0) {
        // Save new registration info into user_registration_info.json
        user_registration_info[username] = {};
        user_registration_info[username].name = request.body.name;
        // Store encrypted password into user_registration_info
        user_registration_info[username].password = hashPassword(request.body.password);
        // IR4 add lastLoginDate and loginCount for this new user make it a string
        user_registration_info[username].lastLoginDate = Date.now();
        user_registration_info[username].loginCount = 1;

        // Write to our user_registration_info.json file, we add the null and 2 option to account for a null replacer, and indentation
        fs.writeFileSync(filename, JSON.stringify(user_registration_info, null, 2));

        // Add username to keep track of amount of logged in users
        // Check if loggedInUsers already has the username so that we don't login more than once for the same user
        if (!loggedInUsers.hasOwnProperty(username)) {
            loggedInUsers[username] = true; // You can use `true` to indicate that the user is logged in.
        }

        // Create params variable and add username and name fields
        let params = new URLSearchParams(request.body);
        params.append("loginCount", user_registration_info[username].loginCount);
        params.append("lastLogin", user_registration_info[username].lastLoginDate);
        response.redirect("./registrationsuccess.html?" + params.toString());

        return;

        // If any errors exist, redirect to registration.html with the errors
    } else {
        let params = new URLSearchParams();
        params.append("username", username);
        params.append("name", name);
        params.append("errorString", JSON.stringify(errors));
        response.redirect("./registration.html?" + params.toString());
    }
});

app.post('/viewInvoice', (request, response) => {
    const username = request.body["username"];
    const name = request.body["name"];

    // Create params variable and add username and name fields
    let params = new URLSearchParams(request.body);
    params.append("username", username);
    params.append("name", name);
    params.append("loginCount", user_registration_info[username].loginCount);
    params.append("lastLogin", user_registration_info[username].lastLoginDate);
    response.redirect("./invoice.html?" + params.toString());

})

app.get('/pre-checkout', (request, response) => {
    // check if user is logged in. If not, redirect to login
    if (!request.cookies.userinfo) {
        response.redirect('./login.html');
        return;
    }

    // before checkout

    // send to final invoice
    response.redirect("./invoice.html");
    return;
})


app.get('/checkout', (request, response) => {
    // check if user is logged in. If not, redirect to login
    if (!request.cookies.userinfo) {
        response.redirect('./login.html');
        return;
    }

    // console.log(userinfo);
    // console.log(userinfo["email"]);
    // console.log(userinfo.email);

    // For some reason, accessing these values in userinfo doesn't work    
    let userinfo = JSON.parse(request.cookies.userinfo);

    // Creating a final invoice 
    str = `
    <h2>Thank you ${userinfo.full_name} for your purchase! Please see your invoice below.</h2>
    <div class="flex-box-container">
    <div class="flex-box">
      <!--Where I will print my invoice-->
      <table border="2">
        <tbody>

          <!-- column titles row -->
          <tr>
            <th style="text-align: center;" width="11%">Image</th>
            <th style="text-align: center;" width="26%">Item</th>
            <th style="text-align: center;" width="11%">Quantity</th>
            <th style="text-align: center;" width="13%">Price</th>
            <th style="text-align: center;" width="20%">Price Altogether</th>
            <th style="text-align: center;" width="10%">Rating</th>
            <th style="text-align: center;" width="20%">Comments</th>
          </tr>
          `;

    // Declare cart data variable
    var cart_data = request.session.cart;


    // Add more table rows
    for (let pkey in cart_data) {
        let products = all_products[pkey];
        for (let i in products) {
            let qty = cart_data[pkey]['quantity' + i];
            if (qty == 0) {
                continue;
            }

            var extended_price = qty * products[i].price;
            subtotal += extended_price;

            str += `
            <tr>
             <td height="70px" width="11%">
              <div class="img-mouseover">
                <img src="./img/${products[i].image}" height="100px" width="100px">
                <div class="product-description">
                  ${products[i].description}
                  </div>
                </div></td>
              <td width="26%">${products[i].name}</td>
              <td align="center" width="11%">${qty}<br><font color = "red"></td>
              <td width="13%">$${products[i].price}</td>
              <td width="20%">$${(extended_price).toFixed(2)}</td>
              <td width="10%">
          <select class="rating" name="rating_${i}">
            <option value="">Rate...</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </td>
        <td width="20%">
          <input type="text" name="comment_${i}" placeholder="Leave a comment">
        </td>
            </tr>
            `;
        }
    }
    // Subtotal
    var subtotal = 0;

    // Tax rate
    var tax_rate = 0.04712;
    var tax = tax_rate * subtotal;

    // Compute shipping (if subtotal is less than 80, shipping is $10, otherwise it's free)
    if (subtotal < 80) { shipping = 10 }
    else { shipping = 0 };

    // Grand total
    var total = subtotal + tax + shipping;

    str += `
            <tr>
              <td colspan="5" width="100%">&nbsp;</td>
            </tr>
            <tr>
              <td style="text-align: right;" colspan="3" width="67%">Subtotal</td>
              <td colspan="2" width="54%">$${(subtotal).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="text-align: right;" colspan="3" width="67%">Tax @ 4.71%</span></td>
              <td colspan="2" width="54%">$${(tax).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="text-align: right;" colspan="3" width="67%">Shipping</span></td>
              <td colspan="2" width="54%">$${shipping}</td>
            </tr>
            <tr>
              <td style="text-align: right;" colspan="3" width="67%"><b>Total</b></td>
              <td colspan="2" width="54%"><b>$${(total).toFixed(2)}</b></td>
            </tr>
            </tbody >
            </table >
            <h4><strong> Our shipping policy is: A subtotal of $0-$80 will be $10 shipping. Subtotals over $80 will have free
            shipping</strong></h4>
            
            <h1>We have emailed your invoice to ${userinfo['email']}!</h1>
            </div>
            </div>
    `;

    // Final checkout

    // remove items purchased from inventory
    for (let pkey in request.session.cart_data) {
        for (let i in all_products[pkey]) {
            // Update sets available
            all_products[pkey][i].sets_available -= Number(Number(request.session.cart_data[pkey][`quantity${i} `]));
            // Track total quantity of each item sold - code from Assignment 1
            all_products[pkey][i].sets_sold += Number(Number(request.session.cart_data[pkey][`quantity${i} `]));
        }
    }
    // email invoice to user

    // send to final invoice

    // Referenced from assignment 3 code example
    // Create a transporter variable for nodemailer
    var transporter = nodemailer.createTransport({
        host: "mail.hawaii.edu",
        port: 25,
        secure: false, // use TLS
        tls: {
            // do not fail on invalid certs
            rejectUnauthorized: false,
        },
    });

    // Options for email
    var mailOptions = {
        from: "wenailed@hawaii.edu", //sender
        to: userinfo.email, //receiver
        subject: "Thank you for your order!", // subject heading
        html: str, //html body (invoice)
    };

    // Attempt to send email
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            str += `<script>alert('Oops, ${userinfo.full_name}, there was an error and your invoice could not be sent');</script>`;
        } else {
            str += `<script>alert('Your invoice was mailed to ${userinfo.email}');</script>`;
        }
    });

    response.send(str);
    return;
});

// update the session quantities with updated amounts from cart
app.post("/update_cart", function (request, response, next) {
    // set updated_cart variable to the contents of the request body
    var updated_cart = request.body;

    // empty errors
    var errors = {};
    // validate updated quantities
    for (let updatekey in updated_cart) { // loop through updated cart
        let prod_key = updatekey.split("_")[1]; // get product type
        let prod_num = updatekey.split("_")[2]; // get product number
        // updates the cart with the new quantities
        request.session.cart[prod_key]["quantity" + prod_num] = updated_cart[updatekey];
    }

    if (Object.keys(errors).length == 0) {
        // no errors so update cart
    } else {
        let params = new URLSearchParams();
        params.append("errors", JSON.stringify(errors));
        response.redirect(`./cart.html?${params.toString()}`);
    }

    response.redirect(`./cart.html?`);
});

// function to find if a number is a non negative integer, and if not, output errors
function findNonNegInt(q, returnErrors = false) {
    //the function returns non-negative integers in the object.
    errors = []; // assume no errors at first
    if (Number(q) != q) errors.push("Not a number!"); // Check if string is a number value
    if (q < 0) errors.push("Negative value!"); // Check if it is non-negative
    if (parseInt(q) != q) errors.push("Not an integer!"); // Check that it is an integer

    return returnErrors ? errors : errors.length == 0;
}

// Logout route to expire the cookie redirect them to the homepage afterwards
app.get('/logout', function(req, res, next) {
    res.clearCookie('userinfo');
    res.redirect("home.html");

});


/*
    // Prepare and send the thank you message
    const thankYouMessage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400&display=swap" rel="stylesheet">
            <style>
                body {
                    font-family: 'Montserrat', sans-serif;
                    background-image: url(img/topback.png);
                    background-position: center;
                    background-size: cover;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                }
                .message-container {
                    text-align: center;
                }
                .thank-you-message {
                    font-size: 30px; // Adjusted font size to 30px 
                    margin-bottom: 10px;
                }
                .bold-red {
                    font-weight: bold;
                    color: red;
                }
                .logout-message {
                    font-size: 24px; // Adjusted font size to 24px 
                    margin-bottom: 10px;
                }
            </style>
        </head>
        <body>
            <div class="message-container">
                <div class="thank-you-message">
                    Thank you for your purchase, <span class="bold-red">${user_registration_info[username].name}</span>.
                </div>
                <div class="logout-message">
                    Logged out ${username}.
                </div>
                <div>
                    You will be redirected to the home page in 5 seconds.
                </div>
            </div>
            <meta http-equiv="refresh" content="5;url=/home.html">
        </body>
        </html>
    `;
    */


// Serve static files
app.use(express.static(__dirname + '/public'));


// Admin Routes

// Path to your products.json file
const productsFilePath = path.join(__dirname, 'products.json');

// Function to read products data
function readProductsData() {
    const productsData = fs.readFileSync(productsFilePath, 'utf8');
    return JSON.parse(productsData);
}

// Function to write products data
function writeProductsData(data) {
    fs.writeFileSync(productsFilePath, JSON.stringify(data, null, 2), 'utf8');
}

// POST route for admin login
app.post('/admin/login', function (request, response) {
    let username = request.body.username;
    let password = request.body.password;
    // Checks if user is admin and password is correct
    if (isAdmin(username) && user_registration_info[username].password === hashPassword(password)) {
        request.session.user = username; // Sets session user
        request.session.isAdmin = true; // Sets session admin flag
        // Redirects to admin choice page upon successful login
        response.redirect('/admin/choice');
    } else {
        // Sends alert and redirects to admin login page if credentials are invalid
        response.send(`<script>alert("Invalid credentials or not an admin"); window.location.href = '/admin_login.html';</script>`);
    }
});

// GET route to display admin choice page after login
app.get('/admin/choice', function (request, response) {
    // Checks if the user has admin privileges
    if (request.session.isAdmin) {
        // Serves a simple HTML page with admin options
        response.send(`
            <h1>Welcome Admin</h1>
            <p>Choose where you would like to go:</p>
            <a href="/admin_panel.html">Admin Panel</a> | <a href="/products_display.html">User Interface</a>
        `);
    } else {
        // Redirects to general login page if not an admin
        response.redirect('/login.html');
    }
});

// Middleware to ensure that user is an admin for accessing admin routes
app.use('/admin/inventory', requireAdmin);
app.use('/admin/users', requireAdmin);

app.post('/admin/create_product', (req, res) => {
    const { collection, product } = req.body;
    
    // Read the current product data
    const products = readProductsData();

    // Check if the specified collection exists
    if (products[collection]) {
        // Add the new product to the collection
        products[collection].push(product);
        
        // Write the updated product data back to the file
        writeProductsData(products);

        res.send({ success: true, message: 'Product created successfully' });
    } else {
        res.status(404).send({ success: false, message: 'Collection not found' }); // Nani?
    }
});


app.post('/admin/delete_product',requireAdmin, (req, res) => {
    const { collection, productName } = req.body;
    
    // Read the current product data
    const products = readProductsData();

    // Check if the product exists in the specified collection
    if (products[collection]) {
        // Filter out the product to be deleted
        products[collection] = products[collection].filter(product => product.name !== productName);
        
        // Write the updated product data back to the file
        writeProductsData(products);

        res.send({ success: true, message: 'Product deleted successfully' });
    } else {
        res.status(404).send({ success: false, message: 'Collection or product not found' });
    }
});



// POST route for admin to add, edit, delete, or toggle role of user accounts
app.post('/admin/users', requireAdmin, function (request, response) {
    if (!request.session.isAdmin) {
        return response.status(403).send('Access denied'); // Denies access if not admin
    }
    const { action, username, userData } = request.body;
    // Handles different actions (add, edit, delete, toggleAdmin) on user accounts
    switch (action) {
        case 'add':
            if (!user_registration_info[username]) {
                userData.password = hashPassword(userData.password); // Hashes password for new user
                user_registration_info[username] = userData; // Adds new user
            } else {
                return response.status(400).send('User already exists'); // Sends error if user exists
            }
            break;
        case 'edit':
            if (user_registration_info[username]) {
                if(userData.password) {
                    userData.password = hashPassword(userData.password); // Hashes password if provided
                }
                user_registration_info[username] = { ...user_registration_info[username], ...userData }; // Edits existing user
            } else {
                return response.status(404).send('User not found'); // Sends error if user not found
            }
            break;
        case 'delete':
            if (user_registration_info[username]) {
                delete user_registration_info[username]; // Deletes user
            } else {
                return response.status(404).send('User not found'); // Sends error if user not found
            }
            break;
        case 'toggleAdmin':
            if (user_registration_info[username]) {
                user_registration_info[username].role = user_registration_info[username].role === 'admin' ? 'user' : 'admin'; // Toggles user's admin role between being an admin not not being one 
            } else {
                return response.status(404).send('User not found'); // Sends error if user not found
            }
            break;
        default:
            return response.status(400).send('Invalid action'); // Sends error if action is invalid
    }
    // Saves changes to user registration file
    fs.writeFileSync(filename, JSON.stringify(user_registration_info, null, 2));
    response.send({ success: true, message: 'User account updated' }); // Confirms user account update
});

// Starts the server on port 8080
app.listen(8080, () => console.log(`listening on port 8080`));

// Utility function to check if a string is a non-negative integer
function findNonNegInt(q, returnErrors = false) {
    const errors = [];
    // Validates if q is a non-negative integer
    if (Number(q) != q) errors.push('Please enter a number!');
    if (q < 0) errors.push('Please enter a non-negative value!');
    if (parseInt(q) != q) errors.push('This is not an integer!');
    return returnErrors ? errors : errors.length === 0;
};