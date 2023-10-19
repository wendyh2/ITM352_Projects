function FindStringisNonNegInt(q, returnErrors = false) { //the function returns non-negative integers within the object
    errors = []; // assume no errors at first
    if(Number(q) != q) errors.push('Not a number!'); // Check if string is a number value
    if(q < 0) errors.push('Negative value!'); // Check if it is non-negative
    if(parseInt(q) != q) errors.push('Not an integer!'); // Check that it is an integer    

    return (errors.length == 0);
}

let attributes  =  "Wendy; 20; 20.5; -19.5 ";
let pieces = attributes.split(';');
 /* for(let i in pieces) {
    console.log(part, typeof part);
    } 
 // console.log(part, FindStringisNonNegInt(part));
    checkIt(pieces[i], i);
}
pieces.forEach(checkIt);
function checkIt(item, index) {
    console.log(`part ${index} is ${(FindStringisNonNegInt(item)?'a':'not a')} quantity`);
}
*/

pieces.forEach((item,index) => {
    console.log(`part ${index} is ${(FindStringisNonNegInt(item)?'a':'not a')} quantity`);
} )