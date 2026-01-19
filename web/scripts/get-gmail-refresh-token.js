/**
 * Gmail OAuth Setup Script
 * 
 * This script helps you obtain the refresh token for Gmail OAuth.
 * Run this ONCE to get the refresh token, then add it to your .env file.
 * 
 * Usage:
 * 1. Run: node scripts/get-gmail-refresh-token.js
 * 2. Open the URL in browser
 * 3. Authorize the app
 * 4. Copy the code from the callback URL
 * 5. Paste it when prompted
 * 6. Copy the refresh token to your .env file
 */

const { google } = require('googleapis');
const readline = require('readline');
const http = require('http');
const url = require('url');

// OAuth Configuration
const CLIENT_ID = '354227009682-eq7k9c4raa91gotpsrco06tph22uaeca.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3333/callback';
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force refresh token to be returned
});

console.log('\n=================================================');
console.log('       Gmail OAuth Refresh Token Setup');
console.log('=================================================\n');
console.log('This script will help you obtain the Gmail refresh token.');
console.log('The refresh token allows the app to send emails on your behalf.\n');
console.log('📧 Email to authorize: continuum1105@gmail.com\n');

console.log('Starting local server to receive the callback...\n');

// Create a simple HTTP server to catch the callback
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.query.code;
        
        if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1e293b; color: white;">
                        <h1 style="color: #10b981;">✅ Authorization Successful!</h1>
                        <p>You can close this window and check the terminal for your refresh token.</p>
                    </body>
                </html>
            `);
            
            try {
                // Exchange code for tokens
                const { tokens } = await oauth2Client.getToken(code);
                
                console.log('\n✅ Authorization successful!\n');
                console.log('=================================================');
                console.log('      YOUR REFRESH TOKEN (SAVE THIS!)');
                console.log('=================================================');
                console.log(`\n${tokens.refresh_token}\n`);
                console.log('=================================================\n');
                console.log('Add this to your .env file:');
                console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
                console.log('Other tokens received:');
                console.log(`- Access Token: ${tokens.access_token ? '✅ Received' : '❌ Not received'}`);
                console.log(`- Token Type: ${tokens.token_type}`);
                console.log(`- Expires In: ${tokens.expiry_date ? new Date(tokens.expiry_date).toLocaleString() : 'N/A'}\n`);
                
                if (!tokens.refresh_token) {
                    console.log('⚠️  No refresh token received!');
                    console.log('This happens if you\'ve already authorized this app before.');
                    console.log('To fix this:');
                    console.log('1. Go to https://myaccount.google.com/permissions');
                    console.log('2. Remove "TetraDeck" or your app from the list');
                    console.log('3. Run this script again\n');
                }
                
            } catch (error) {
                console.error('Error exchanging code for tokens:', error.message);
            }
            
            // Close the server after processing
            setTimeout(() => {
                server.close();
                process.exit(0);
            }, 1000);
            
        } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Error: No code received</h1>');
        }
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(3333, () => {
    console.log('📡 Callback server running on http://localhost:3333');
    console.log('\n🔗 Open this URL in your browser:\n');
    console.log(`${authUrl}\n`);
    console.log('Make sure to sign in with: continuum1105@gmail.com');
    console.log('\nWaiting for authorization callback...\n');
});

// Handle server errors
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('❌ Port 3333 is already in use. Please close any other servers and try again.');
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});
