let monthly_sales = [550, 350, 20, 600];
let tax_rate = 0.05;

function TaxesOwed(sales, tax){
    let tax_owing = [];

}

function TaxesOwed(sales, tax){
    let tax_owing = [];
    for (let i = 0; i < sales.length; i++) {
        tax_owing.push(sales[i]*tax);
    }
    return tax_owing;
}

let tax_owing = TaxesOwed(monthly_sales, tax_rate);
console.log(tax_owing);