const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('OK'));

const server = app.listen(5000, () => {
    console.log('Test server on 5000');
});

// Keep process alive
process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.close();
    process.exit(0);
});
