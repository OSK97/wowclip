const fs = require('fs');
const content = fs.readFileSync('public/maps/countries/india.svg', 'utf8');
const matches = [...content.matchAll(/id="([^"]+)"\s+name="([^"]+)"/g)];
console.log(matches.map(m => m[1] + ' : ' + m[2]).join('\n'));
