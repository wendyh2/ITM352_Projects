function FindStringisNonNegInt(q, returnErrors = false) { //the function returns non-negative integers within the object
    errors = []; // assume no errors at first
    if(Number(q) != q) errors.push('Not a number!'); // Check if string is a number value
    if(q < 0) errors.push('Negative value!'); // Check if it is non-negative
    if(parseInt(q) != q) errors.push('Not an integer!'); // Check that it is an integer    

    return returnErrors ? errors : (errors.length == 0);
}

let attributes  =  "Wendy; 20; 20.5; -19.5 ";
let pieces = attributes.split(';');
for(let part of pieces) {
console.log(`${part} is a quantity ${FindStringisNonNegInt(part, true)}`);
}