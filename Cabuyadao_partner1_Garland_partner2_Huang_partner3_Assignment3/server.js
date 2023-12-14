// Author: Wendy Huang
// Date: 11/10/2023
// My server js file that runs the server for my site. This was taken from our Lab12 with permission from Dan to use it

// Updating main

const express = require('express');
const app = express();
const querystring = require('querystring');
const all_products = require(__dirname + '/products.json');
const fs = require("fs");
const cookieParser = require('cookie-parser');
app.use(cookieParser());

const session = require('express-session');

//test for IR1
app.use(session({
    secret: "YourSecretKey",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // set max cookie age for 24 hours so it does not stay and cause issues in the long term. 
}));

// Middleware to store and redirect to the last visited page
app.use(function (request, response, next) {
    const nonStorePaths = ['/login', '/logout', '/register', '/', '/index.html', '/server.js'];
    const assetExtensions = ['.jpg', '.png', '.gif', '.css', '.js'];
    const currentPath = request.url;

    // Check if the path is not an asset and not in the nonStorePaths array
    if (!assetExtensions.some(ext => currentPath.endsWith(ext)) && !nonStorePaths.includes(currentPath)) {
        request.session.lastVisitedPage = currentPath;
    }

    // Redirect to the last visited page if the current request is for the home page and there's a stored page
    if ((currentPath === '/' || currentPath === '/index.html') && request.session.lastVisitedPage) {
        const lastPage = request.session.lastVisitedPage;
        request.session.lastVisitedPage = null; // Clear to avoid repeated redirections
        return response.redirect(lastPage);
    }

    next();
});
//End of test for IR1

// IR1: Use crypto library to encrypt password
const crypto = require('crypto');

// IR5:  Keep track of the number of users currently logged in to the site and display this number with the personalization information.
// This is the global array variable
const loggedInUsers = {};

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
    next();
});

// Route to provide products data as a JavaScript file
app.get("/products_data.js", function (request, response, next) {
    response.type('.js');
    const products_str = `let all_products = ${JSON.stringify(all_products)}`;
    response.send(products_str);
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

    // Create variables username & password - referenced from Assignment 2 example code
    let username = request.body["username"].toLowerCase();
    let password = request.body["password"];

    // Check if username exists in user_registration_info.json
    if (user_registration_info.hasOwnProperty(username)) {
        // IR1: Encrypt the password and check it against the user_registration_info encrypted password 
        if (hashPassword(password) !== user_registration_info[username].password) {
            errors[`password_error`] = "Password is incorrect.";
        }
    } else {
        errors[`username_error`] = `${username} is not a registered email.`;
    }

    // If all the login information is valid
    if (Object.keys(errors).length === 0) {
        let name = user_registration_info[username].name;

        // Check if the user is an admin
        if (isAdmin(username)) {
            // Redirect to the admin panel page
            response.redirect("./admin_panel.html");
        } else {
            // Regular user logic
            // send a usernames cookie to indicate they're logged in
            response.cookie("userinfo", JSON.stringify({ "email": username, "full_name": name }), { expire: Date.now() + 60 * 1000 });
            // IR4 - Keep track of the number of times a user logged in and the last time they logged in.
            user_registration_info[username].loginCount += 1;
            user_registration_info[username].lastLoginDate = Date.now();

            // IR5: Add username to keep track of amount of logged in users
            if (!loggedInUsers.hasOwnProperty(username)) {
                loggedInUsers[username] = true;
            }

            // Create params variable and add username and name fields
            let params = new URLSearchParams();
            params.append("loginCount", user_registration_info[username].loginCount);
            params.append("lastLogin", user_registration_info[username].lastLoginDate);


            // Redirect to invoice.html with the new params values
            response.redirect("./products_display.html?" + params.toString());
            return;
        }
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

        // IR2: Require that passwords have at least one number and one special character, regex referenced from ChatGPT
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
        // IR1: Store encrypted password into user_registration_info
        user_registration_info[username].password = hashPassword(request.body.password);
        // IR4 add lastLoginDate and loginCount for this new user make it a string
        user_registration_info[username].lastLoginDate = Date.now();
        user_registration_info[username].loginCount = 1;

        // Write to our user_registration_info.json file, we add the null and 2 option to account for a null replacer, and indentation
        fs.writeFileSync(filename, JSON.stringify(user_registration_info, null, 2));

        // IR5: Add username to keep track of amount of logged in users
        // Check if loggedInUsers already has the username so that we don't login more than once for the same user
        if (!loggedInUsers.hasOwnProperty(username)) {
            loggedInUsers[username] = true; // You can use `true` to indicate that the user is logged in.
        }
        /*
                // When the purchase is valid this will reduce our inventory by the amounts purchased
        
                for (let i in all_products) {
                    // Update sets available
                    all_products[i].sets_available -= Number(request.body[`quantity${i}`]);
                    // Track total quantity of each item sold - code from Assignment 1
                    all_products[i].sets_sold += Number(request.body[`quantity${i}`]);
                }
        */
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

app.get('/checkout', (request, response) => {
    // check if user is logged in. If not, redirect to login
    if(!request.cookies.userinfo) {
        response.redirect('./login.html');
        return;
    }

    // Final checkout

    // remove items purchased from inventory
    for (let pkey in request.session.cart) {
        for (let i in all_products[pkey]) {
            // Update sets available
            all_products[pkey][i].sets_available -= Number(Number(request.session.cart[pkey][`quantity${i}`]));
            // Track total quantity of each item sold - code from Assignment 1
            all_products[pkey][i].sets_sold += Number(Number(request.session.cart[pkey][`quantity${i}`]));
        }
    }
    // email invoice to user

    // send to final invoice
    response.redirect("./invoice.html");
    return;
})

//IR5: Logout route that sends user to login page
    app.get('/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) {
                res.status(500).send('Error logging out');
            } else {
                res.redirect('/login.html'); // Redirect to login page after logout
            }
        });
    });    

    // Thank user for purchase and tell them they are logged out then redirect to home.html
    response.send(`
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
            font-size: 30px; /* Adjusted font size to 30px */
            margin-bottom: 10px;
        }
        .bold-red {
            font-weight: bold;
            color: red;
        }
        .logout-message {
            font-size: 24px; /* Adjusted font size to 24px */
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
    <meta http-equiv="refresh" content="5;url=home.html">
</body>
</html>
`);
});

// Serve static files
app.use(express.static(__dirname + '/public'));


// Admin Routes

// Admin login route
app.post('/admin/login', function (request, response) {
    let username = request.body.username;
    let password = request.body.password;
    if (isAdmin(username) && user_registration_info[username].password === hashPassword(password)) {
        request.session.isAdmin = true;
        response.send({ success: true });
    } else {
        response.send({ success: false, message: 'Invalid credentials or not an admin' });
    }
});

// Admin add/edit/delete inventory route
app.post('/admin/inventory', function (request, response) {
    if (!request.session.isAdmin) {
        response.status(403).send('Access denied');
        return;
    }

    const action = request.body.action;
    const product = request.body.product;

    switch (action) {
        case 'add':
            all_products[product.id] = product; // Assuming product object contains all necessary details
            break;
        case 'edit':
            if (all_products[product.id]) {
                all_products[product.id] = product;
            } else {
                response.status(404).send('Product not found');
                return;
            }
            break;
        case 'delete':
            if (all_products[product.id]) {
                delete all_products[product.id];
            } else {
                response.status(404).send('Product not found');
                return;
            }
            break;
        default:
            response.status(400).send('Invalid action');
            return;
    }

    response.send({ success: true, message: 'Inventory updated' });
});

// Admin add/edit/delete user accounts route
app.post('/admin/users', function (request, response) {
    if (!request.session.isAdmin) {
        return response.status(403).send('Access denied');
    }

    const { action, username, userData } = request.body;

    switch (action) {
        case 'add':
            // Add a new user
            if (!user_registration_info[username]) {
                user_registration_info[username] = userData;
            } else {
                return response.status(400).send('User already exists');
            }
            break;
        case 'edit':
            // Edit an existing user
            if (user_registration_info[username]) {
                user_registration_info[username] = { ...user_registration_info[username], ...userData };
            } else {
                return response.status(404).send('User not found');
            }
            break;
        case 'delete':
            // Delete a user
            if (user_registration_info[username]) {
                delete user_registration_info[username];
            } else {
                return response.status(404).send('User not found');
            }
            break;
        case 'toggleAdmin':
            // Toggle admin role
            if (user_registration_info[username]) {
                user_registration_info[username].role = user_registration_info[username].role === 'admin' ? 'user' : 'admin';
            } else {
                return response.status(404).send('User not found');
            }
            break;
        default:
            return response.status(400).send('Invalid action');
    }

    // Save changes to file
    fs.writeFileSync(filename, JSON.stringify(user_registration_info, null, 2));

    response.send({ success: true, message: 'User account updated' });
});

// Start server
app.listen(8080, () => console.log(`listening on port 8080`));

function findNonNegInt(q, returnErrors = false) {
    const errors = [];
    if (Number(q) != q) errors.push('Please enter a number!'); // Check if string is a number value
    if (q < 0) errors.push('Please enter a non-negative value!'); // Check if it is non-negative
    if (parseInt(q) != q) errors.push('This is not an integer!'); // Check that it is an integer

    return returnErrors ? errors : errors.length === 0;
};