/**
 * Deploy a local folder to Render via deployment worker
 * Usage: node deploy-folder.js <folder-path> <app-name>
 */

const fs = require('fs').promises;
const path = require('path');

async function readFilesRecursively(dir, baseDir = dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    // Skip node_modules, .git, and other common excludes
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
          path: relativePath.replace(/\\/g, '/'), // Convert Windows paths to Unix
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

async function deployFolder(folderPath, appName) {
  try {
    console.log(`📦 Reading files from: ${folderPath}`);
    
    // Read all files
    const files = await readFilesRecursively(folderPath);
    console.log(`✅ Found ${files.length} files`);
    
    // Show files being deployed
    console.log('\n📄 Files to deploy:');
    files.slice(0, 20).forEach(f => console.log(`   - ${f.path}`));
    if (files.length > 20) {
      console.log(`   ... and ${files.length - 20} more files`);
    }
    
    // Deploy
    console.log(`\n🚀 Deploying to Render as: ${appName}`);
    
    const response = await fetch('http://localhost:3001/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appName,
        files,
        env: {
          NODE_ENV: 'production',
        },
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
    console.log('\n⏳ Note: First deployment takes 5-10 minutes to build.');
    console.log(`📊 Check build status: https://dashboard.render.com/web/${result.serviceId}`);
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node deploy-folder.js <folder-path> <app-name>');
  console.log('\nExample:');
  console.log('  node deploy-folder.js ../my-backend-app my-api');
  console.log('  node deploy-folder.js ./server my-express-api');
  process.exit(1);
}

const [folderPath, appName] = args;

// Validate folder exists
fs.access(folderPath)
  .then(() => deployFolder(folderPath, appName))
  .catch(() => {
    console.error(`❌ Folder not found: ${folderPath}`);
    process.exit(1);
  });
