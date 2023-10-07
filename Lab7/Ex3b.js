require("./products_data");

let num_products = 5;
for(let product_num = 1; eval("typeof name" + product_num) != 'undefined'; product_num++) {
    /*
    if(prod_number > num_products/2) {
        console.log(`Don't ask for anything else!`);
        process.exit(1);
    }
    if(product_num > .25*num_products && product_num < .75*num_products) {
        console.log(`${eval('name' + product_num)} is sold out!`)
        continue;
    }
    */
    console.log(product_num + '.' + eval('name' + product_num));
    
 
}
console.log(`That's all we have!`);