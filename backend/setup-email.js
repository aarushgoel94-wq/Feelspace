#!/usr/bin/env node

/**
 * Email Setup Script
 * 
 * This script helps you set up email notifications for reports.
 * It will test your email configuration and send a test email.
 */

const nodemailer = require('nodemailer');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testEmail() {
  console.log('\n📧 Email Setup for Report Notifications\n');
  console.log('This script will help you configure email notifications.');
  console.log('Reports will be sent to: feelspacemood@gmail.com\n');

  const emailUser = await question('Enter your Gmail address (feelspacemood@gmail.com): ');
  const emailPass = await question('Enter your Gmail App Password (16 characters): ');

  if (!emailUser || !emailPass) {
    console.error('\n❌ Email address and password are required.');
    rl.close();
    process.exit(1);
  }

  console.log('\n🔧 Creating email transporter...');
  
  let transporter;
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser.trim(),
        pass: emailPass.trim(),
      },
    });

    console.log('✅ Transporter created. Verifying connection...');
    
    await transporter.verify();
    console.log('✅ Connection verified successfully!\n');

    console.log('📧 Sending test email...');
    
    const testEmailContent = {
      from: emailUser.trim(),
      to: 'feelspacemood@gmail.com',
      subject: 'Test Email - Let It Out Report System',
      html: `
        <h2>✅ Email Configuration Successful!</h2>
        <p>This is a test email from the Let It Out backend.</p>
        <p>If you received this email, your email configuration is working correctly.</p>
        <p><strong>Next steps:</strong></p>
        <ol>
          <li>Set the EMAIL_PASSWORD environment variable with your App Password</li>
          <li>Set the EMAIL_USER environment variable (optional, defaults to feelspacemood@gmail.com)</li>
          <li>Restart your backend server</li>
        </ol>
        <p><small>Sent at: ${new Date().toLocaleString()}</small></p>
      `,
      text: `
Email Configuration Successful!

This is a test email from the Let It Out backend.

If you received this email, your email configuration is working correctly.

Next steps:
1. Set the EMAIL_PASSWORD environment variable with your App Password
2. Set the EMAIL_USER environment variable (optional, defaults to feelspacemood@gmail.com)
3. Restart your backend server

Sent at: ${new Date().toLocaleString()}
      `,
    };

    const info = await transporter.sendMail(testEmailContent);
    
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response || 'N/A'}\n`);
    
    console.log('📝 Environment Variables to Set:\n');
    console.log(`   EMAIL_USER=${emailUser.trim()}`);
    console.log(`   EMAIL_PASSWORD=${emailPass.trim()}\n`);
    
    console.log('💡 To set these in your .env file:');
    console.log('   1. Create a .env file in the backend directory');
    console.log('   2. Add the lines above');
    console.log('   3. Restart your server\n');
    
    console.log('✅ Email setup complete! Check feelspacemood@gmail.com for the test email.\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('   Error code:', error.code || 'N/A');
    
    if (error.code === 'EAUTH') {
      console.error('\n🔐 AUTHENTICATION ERROR:');
      console.error('   The email password is incorrect.');
      console.error('   Make sure you\'re using a Gmail App Password, not your regular password.');
      console.error('   Get an App Password: https://support.google.com/accounts/answer/185833\n');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error('\n🌐 CONNECTION ERROR:');
      console.error('   Could not connect to Gmail servers.');
      console.error('   Check your internet connection.\n');
    } else {
      console.error('\n   Full error:', error);
    }
    
    rl.close();
    process.exit(1);
  }

  rl.close();
}

testEmail().catch((error) => {
  console.error('Unexpected error:', error);
  rl.close();
  process.exit(1);
});
