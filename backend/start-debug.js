// Wrapper to start server with error handling
process.on('uncaughtException', e => {
    console.error('UNCAUGHT EXCEPTION:', e);
});

process.on('unhandledRejection', e => {
    console.error('UNHANDLED REJECTION:', e);
});

require('./server.js');
