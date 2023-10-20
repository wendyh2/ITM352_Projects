year = 2003;
day = 12;
month = 1;
step1 = 3;
step2 = parseInt(step1/4);
step3 = step1 + step2
step5 = step3 + day;
step8 = step5;
step9 = step8 - 1;
final = step9;

if (final > 7) {
    final = final % 7};
console.log(final);