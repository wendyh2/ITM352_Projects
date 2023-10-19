let attributes  =  "Wendy; 20; 20.5; -19.5 ";
let pieces = attributes.split(';');
for(let part of pieces) {
console.log(`${part} is type ${typeof part}`);
}

let invert = pieces.join(',')
console.log(invert);