// Author: Wendy Huang
// Date: 11/10/2023
// My server js file that runs the server for my site. This was taken from our Lab12 with permission from Dan to use it

// Updating main

const express = require('express');
const app = express();
const querystring = require('querystring');
const products = require(__dirname + '/products.json');
const fs = require("fs");

// IR1: Use crypto library to encrypt password
const crypto = require('crypto');

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

    // If file is not found
} else {
    console.log(`File ${filename} was not found!`);
}
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

// IR5:  Keep track of the number of users currently logged in to the site and display this number with the personalization information.
// This is the global array variable
const loggedInUsers = [];

// Route for getting number of logged in users
app.get('/getLoggedInUsers.js', (request, response) => {
    // We just used the same code as products_data.js but modified it for numLoggedInUsers
    response.type('.js');
    const numLoggedInUsers = `const numLoggedInUsers = ${loggedInUsers.length}`;
    response.send(numLoggedInUsers);
})

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

        // Redirects to the login screen and put values wanted/sold into query string
        response.redirect("./login.html?" + querystring.stringify(request.body));
    } else { // This is if there were errors we send them back to the products display and are notified of the problems 
        response.redirect(
            "./products_display.html?" + querystring.stringify(request.body) + "&" + querystring.stringify(errors)
        ); //We will be redirected to either a invoice page with the data we input if there are errors then we will be redirected to our products display with the errors we found
        console.log(request.body);
    }
});


// Login route, this is a post request and processes username and password against data in user_registration_info.json
app.post("/login", function (request, response, next) {

    // Initialize empty errors
    const errors = {};

    // Create variables username & password - referenced from Assignment 2 example code
    let username = request.body["username"].toLowerCase();
    let password = request.body["password"];

    // Check if username exists in user_registration_info.json
    if (user_registration_info.hasOwnProperty(username) === true) {
        // IR1: Encrypt the password and check it against the user_registration_info encrypted password 
        if (hashPassword(password) !== user_registration_info[username].password) {
            errors[`password_error`] = "Password is incorrect.";
        }
    } else {
        errors[`username_error`] = `${username} is not a registered email.`;
    }


    // If all the login information is valid, redirect to invoice.html with quantities of items purchased, and username and name of user
    if (Object.keys(errors).length === 0) {
        let name = user_registration_info[username].name;
        // IR4 - Keep track of the number of times a user logged in and the last time they logged in.
        user_registration_info[username].loginCount += 1;
        user_registration_info[username].lastLoginDate = Date.now();

        // IR5: Add username to keep track of amount of logged in users
        // Check if loggedInUsers already has the username so that we don't login more than once for the same user
        if (!loggedInUsers.includes(username)) {
            loggedInUsers.push(username);
        }

        // Create params variable and add username and name fields
        let params = new URLSearchParams(request.body);
        params.append("username", username);
        params.append("loginCount", user_registration_info[username].loginCount);
        params.append("lastLogin", user_registration_info[username].lastLoginDate);
        params.append("name", user_registration_info[username].name);

        // When the purchase is valid this will reduce our inventory by the amounts purchased

        for (let i in products) {
            // Update sets available
            products[i].sets_available -= Number(request.body[`quantity${i}`]);
            // Track total quantity of each item sold - code from Assignment 1
            products[i].sets_sold += Number(request.body[`quantity${i}`]);
        }

        // Redirect to invoice.html with the new params values
        response.redirect("./invoice.html?" + params.toString());
    }
    // If login information is invalid, redirects to login page and gives error
    else {
        // Create params variable and add username, name, and errorString fields
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
        if (!loggedInUsers.includes(username)) {
            loggedInUsers.push(username);
        }

        // When the purchase is valid this will reduce our inventory by the amounts purchased

        for (let i in products) {
            // Update sets available
            products[i].sets_available -= Number(request.body[`quantity${i}`]);
            // Track total quantity of each item sold - code from Assignment 1
            products[i].sets_sold += Number(request.body[`quantity${i}`]);
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

//IR5: Logout route that sends user to login page
app.post('/logout', (request, response) => {
    // Get username and index of that username in loggedInUsers array
    const username = request.body["username"];
    const index = loggedInUsers.indexOf(username);

    // Remove username from loggedInUsers array (logging the user out)
    if (index !== -1) {
        loggedInUsers.splice(index, 1);
    }

    // Redirect the user to the login page after logout
    response.redirect('/login.html');
});

// Serve static files
app.use(express.static(__dirname + '/public'));

// Start server
app.listen(8080, () => console.log(`listening on port 8080`));

function findNonNegInt(q, returnErrors = false) {
    const errors = [];
    if (Number(q) != q) errors.push('Please enter a number!'); // Check if string is a number value
    if (q < 0) errors.push('Please enter a non-negative value!'); // Check if it is non-negative
    if (parseInt(q) != q) errors.push('This is not an integer!'); // Check that it is an integer

    return returnErrors ? errors : errors.length === 0;
};