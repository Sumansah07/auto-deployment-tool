/**
 * Deploy backend with environment variables
 */

const fs = require('fs').promises;
const path = require('path');

async function readFilesRecursively(dir, baseDir = dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (shouldExclude(relativePath)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      const subFiles = await readFilesRecursively(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        files.push({
          path: relativePath.replace(/\\/g, '/'),
          content,
        });
      } catch (err) {
        console.log(`⚠️  Skipping binary file: ${relativePath}`);
      }
    }
  }
  
  return files;
}

function shouldExclude(filePath) {
  const excludePatterns = [
    'node_modules',
    '.git',
    '.env',
    '.env.local',
    'dist',
    'build',
    '.DS_Store',
    'npm-debug.log',
    'yarn-error.log',
    '.vscode',
    '.idea',
  ];
  
  return excludePatterns.some(pattern => filePath.includes(pattern));
}

async function deploy() {
  try {
    console.log('📦 Reading files from: ./server');
    
    const files = await readFilesRecursively('./server');
    console.log(`✅ Found ${files.length} files`);
    
    // Environment variables for production
    const envVars = {
      NODE_ENV: 'production',
      PORT: '8000',
      
      // Cloudinary
      CLOUDINARY_NAME: 'dtefq2tcg',
      CLOUDINARY_API_KEY: '234266679357583',
      CLOUDINARY_SECRET_KEY: 'Xlx1UEQnx7ErY87d7y0y1cJiOQ0',
      
      // URLs (will be updated after deployment)
      ADMIN_URL: 'https://your-admin-url.com',
      CLIENT_URL: 'https://your-client-url.com',
      
      // Auth
      JWT_SECRET: '4ec44a09e9133a1a9944651c54ade3575ac8cad6cffede8a03bbadd7b3c35794',
      ADMIN_EMAIL: 'alokver4@gmail.com',
      ADMIN_PASSWORD: 'alok1234',
      
      // Stripe
      STRIPE_SECRET_KEY: 'sk_test_51SPPX32EHeUFPKiCnkbvpu6wcvdSp81R9NNlMQI3eSfOdeu8AHTQvKEwxjMm4JCNfTBkelOS8G3OZrHUO4kCJNE000Iad4jxcy',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_51SPPX32EHeUFPKiCUE8yTeKiV6WwpJbezF1OUJqZv66Lw1TmBtq9mkzotzJxz51RhUhhvP5AXrI2MxfY5NKswx2R00ZJCShnc7',
      STRIPE_WEBHOOK_SECRET: 'whsec_DWndydoW5aFqVvddtZBI6PDzQOopKiy7',
      
      // Supabase
      SUPABASE_URL: 'https://uncaczxywjzwfywncdur.supabase.co',
      SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuY2Fjenh5d2p6d2Z5d25jZHVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDkwMDU1MSwiZXhwIjoyMDg2NDc2NTUxfQ.YsZUyfZYqmcIpWYiSQVtpMnI6E4o-M8TXpITu9DGSwM',
    };
    
    console.log('\n🔐 Environment variables configured:');
    Object.keys(envVars).forEach(key => {
      const value = envVars[key];
      const displayValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
      console.log(`   ${key}: ${displayValue}`);
    });
    
    console.log('\n🚀 Deploying to Render with environment variables...');
    
    const response = await fetch('http://localhost:3001/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appName: 'ecommerce-backend-v2',
        files,
        env: envVars,
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.message || result.error || 'Deployment failed');
    }
    
    console.log('\n✅ Deployment successful!');
    console.log(`\n🌐 Live URL: ${result.url}`);
    console.log(`📦 GitHub Repo: ${result.repoUrl}`);
    console.log(`🆔 Service ID: ${result.serviceId}`);
    console.log('\n📋 All environment variables have been automatically set in Render!');
    console.log('\n⏳ Note: First deployment takes 5-10 minutes to build.');
    console.log(`📊 Check build status: https://dashboard.render.com/web/${result.serviceId}`);
    console.log('\n💡 After deployment completes, update these URLs:');
    console.log(`   ADMIN_URL: Update in Render dashboard to your admin frontend URL`);
    console.log(`   CLIENT_URL: Update in Render dashboard to your client frontend URL`);
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

deploy();
