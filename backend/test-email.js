// Direct test of Gmail API
const GoogleService = require('./src/services/GoogleService');

async function testEmail() {
    console.log('Testing Gmail API...');
    
    try {
        const result = await GoogleService.sendEmail(
            'EMP-RD9TTP',
            'kirancompany094@gmail.com',
            '🧪 Test Email from OAuth',
            '<h1>Hello!</h1><p>This email was sent via Gmail API using OAuth 2.0!</p><p>Sent at: ' + new Date().toISOString() + '</p>'
        );
        
        console.log('Result:', result);
    } catch (err) {
        console.error('Error:', err.message);
    }
    
    process.exit(0);
}

testEmail();
