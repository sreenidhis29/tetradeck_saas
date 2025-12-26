const db = require('./src/config/db');

console.log('Testing database...');
db.query('SELECT 1 as test')
    .then(r => {
        console.log('Database OK:', r);
        process.exit(0);
    })
    .catch(e => {
        console.log('Database FAIL:', e.message);
        process.exit(1);
    });
