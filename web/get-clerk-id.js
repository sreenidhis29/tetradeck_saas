// Run this in browser console when logged into your app at localhost:3000
// Open Developer Tools (F12) -> Console tab -> paste and run:

console.log('Clerk User ID:', window.Clerk?.user?.id);
console.log('Email:', window.Clerk?.user?.emailAddresses[0]?.emailAddress);
