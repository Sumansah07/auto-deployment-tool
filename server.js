/**
 * Deployment Worker Service
 * Handles backend deployments using GitHub + Render
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { Octokit } = require('@octokit/rest');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'deployment-worker' });
});

// Deploy endpoint
app.post('/deploy', async (req, res) => {
  const { files, appName, env = {} } = req.body;
  
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }
  
  if (!appName) {
    return res.status(400).json({ error: 'App name is required' });
  }
  
  console.log(`[DEPLOY] Starting deployment for ${appName}`);
  console.log(`[DEPLOY] Received ${files.length} files`);
  
  const deployDir = path.join('/tmp', `deploy-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  
  try {
    // Validate environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const renderApiKey = process.env.RENDER_API_KEY;
    
    if (!githubToken) {
      return res.status(500).json({ 
        error: 'GITHUB_TOKEN not configured on deployment worker' 
      });
    }
    
    if (!renderApiKey) {
      return res.status(500).json({ 
        error: 'RENDER_API_KEY not configured on deployment worker' 
      });
    }
    
    // Create deployment directory
    await fs.mkdir(deployDir, { recursive: true });
    console.log(`[DEPLOY] Created directory: ${deployDir}`);
    
    // Write all files
    for (const file of files) {
      const filePath = path.join(deployDir, file.path);
      const fileDir = path.dirname(filePath);
      
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
    }
    console.log(`[DEPLOY] Wrote ${files.length} files`);
    
    // Fix package.json if needed (add start script for production)
    const packageJsonPath = path.join(deployDir, 'package.json');
    let buildCommand = 'npm install';
    let hasViteReact = false;
    
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      
      // Check if start script exists
      if (!packageJson.scripts || !packageJson.scripts.start) {
        console.log('[DEPLOY] No start script found, adding one...');
        
        if (!packageJson.scripts) {
          packageJson.scripts = {};
        }
        
        // Detect framework and add appropriate start script
        const hasBuildScript = packageJson.scripts.build;
        const hasVite = packageJson.dependencies?.vite || packageJson.devDependencies?.vite;
        const hasReact = packageJson.dependencies?.react || packageJson.devDependencies?.react;
        const hasExpress = packageJson.dependencies?.express;
        
        if (hasExpress) {
          // Express.js backend - use node to run the main file
          const mainFile = packageJson.main || 'index.js';
          packageJson.scripts.start = `node ${mainFile}`;
          console.log(`[DEPLOY] Added Express.js start script: node ${mainFile}`);
        } else if (hasVite && hasReact) {
          // Vite + React - need to serve built files
          // Add serve package and start script
          if (!packageJson.dependencies) packageJson.dependencies = {};
          packageJson.dependencies.serve = '^14.2.0';
          packageJson.scripts.start = 'serve -s dist -l 8080';
          hasViteReact = true;
          console.log('[DEPLOY] Added Vite start script: serve -s dist');
        } else if (hasBuildScript) {
          // Generic build script - assume it outputs to dist or build
          if (!packageJson.dependencies) packageJson.dependencies = {};
          packageJson.dependencies.serve = '^14.2.0';
          packageJson.scripts.start = 'serve -s dist -l 8080 || serve -s build -l 8080';
          console.log('[DEPLOY] Added generic start script with serve');
        } else {
          // Fallback - try common patterns
          packageJson.scripts.start = 'node index.js || node server.js || node app.js';
          console.log('[DEPLOY] Added fallback start script');
        }
        
        // Write updated package.json
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
        console.log('[DEPLOY] Updated package.json with start script');
      } else {
        console.log(`[DEPLOY] Start script already exists: ${packageJson.scripts.start}`);
      }
      
      // Determine build command
      if (packageJson.scripts?.build) {
        buildCommand = 'npm install && npm run build';
        console.log('[DEPLOY] Build script detected, will use: npm install && npm run build');
      }
    } catch (error) {
      console.warn('[DEPLOY] Could not read/update package.json:', error.message);
      // Continue anyway - maybe it's not a Node.js project
    }
    
    // Create render.yaml for automatic configuration
    const renderYaml = `services:
  - type: web
    name: ${appName}
    env: node
    plan: free
    buildCommand: ${buildCommand}
    startCommand: npm start
    envVars:
${Object.entries(env).map(([key, value]) => `      - key: ${key}\n        value: ${value}`).join('\n')}
`;
    
    const renderYamlPath = path.join(deployDir, 'render.yaml');
    await fs.writeFile(renderYamlPath, renderYaml, 'utf-8');
    console.log('[DEPLOY] Created render.yaml with build command:', buildCommand);
    
    // Initialize Octokit
    const octokit = new Octokit({ auth: githubToken });
    
    // Get authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`[DEPLOY] GitHub user: ${user.login}`);
    
    // Create GitHub repository
    const repoName = `deploy-${appName}`;
    console.log(`[DEPLOY] Creating GitHub repository: ${repoName}`);
    
    let repo;
    try {
      const { data } = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: false,
        auto_init: false,
        description: `Deployed via deployment worker - ${appName}`,
      });
      repo = data;
      console.log(`[DEPLOY] Repository created: ${repo.full_name}`);
    } catch (error) {
      if (error.status === 422) {
        // Repository already exists, get it
        console.log(`[DEPLOY] Repository already exists, fetching...`);
        const { data } = await octokit.repos.get({
          owner: user.login,
          repo: repoName,
        });
        repo = data;
      } else {
        throw error;
      }
    }
    
    // Initialize git repository
    console.log('[DEPLOY] Initializing git repository...');
    await execAsync('git init', { cwd: deployDir });
    await execAsync('git config user.email "deploy@worker.local"', { cwd: deployDir });
    await execAsync('git config user.name "Deployment Worker"', { cwd: deployDir });
    
    // Add all files
    await execAsync('git add .', { cwd: deployDir });
    await execAsync('git commit -m "Deploy via deployment worker"', { cwd: deployDir });
    
    // Set remote and push
    const remoteUrl = `https://${githubToken}@github.com/${user.login}/${repoName}.git`;
    await execAsync(`git remote add origin ${remoteUrl}`, { cwd: deployDir });
    
    console.log('[DEPLOY] Pushing to GitHub...');
    try {
      await execAsync('git push -u origin main --force', { cwd: deployDir });
    } catch (error) {
      // Try master branch if main fails
      await execAsync('git branch -M main', { cwd: deployDir });
      await execAsync('git push -u origin main --force', { cwd: deployDir });
    }
    console.log('[DEPLOY] Code pushed to GitHub');
    
    // Create or update Render service
    console.log('[DEPLOY] Creating Render service...');
    const renderServiceName = appName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Check if service already exists
    const servicesResponse = await fetch('https://api.render.com/v1/services', {
      headers: {
        'Authorization': `Bearer ${renderApiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!servicesResponse.ok) {
      throw new Error(`Failed to fetch Render services: ${servicesResponse.statusText}`);
    }
    
    const services = await servicesResponse.json();
    const existingService = services.find(s => s.service.name === renderServiceName);
    
    let serviceId;
    let serviceUrl;
    
    // If service exists with wrong build command, delete it and recreate
    if (existingService) {
      const currentBuildCommand = existingService.service.serviceDetails.buildCommand;
      console.log(`[DEPLOY] Existing service found with build command: ${currentBuildCommand}`);
      console.log(`[DEPLOY] Required build command: ${buildCommand}`);
      
      // If build commands don't match, delete and recreate
      if (currentBuildCommand !== buildCommand) {
        console.log(`[DEPLOY] Build command mismatch! Deleting old service...`);
        
        const deleteResponse = await fetch(`https://api.render.com/v1/services/${existingService.service.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${renderApiKey}`,
          },
        });
        
        if (!deleteResponse.ok) {
          console.error(`[DEPLOY] Failed to delete service: ${deleteResponse.statusText}`);
          // Continue anyway - maybe we can still update it
        } else {
          console.log(`[DEPLOY] Old service deleted successfully`);
          // Wait a bit for deletion to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Create new service (code below will handle this)
      } else {
        // Build command matches, just update env vars and redeploy
        serviceId = existingService.service.id;
        console.log(`[DEPLOY] Service exists with correct build command, updating: ${serviceId}`);
        
        // Update env vars
        if (Object.keys(env).length > 0) {
          const updateEnvResponse = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${renderApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              Object.entries(env).map(([key, value]) => ({
                key,
                value,
              }))
            ),
          });
          
          if (!updateEnvResponse.ok) {
            const errorText = await updateEnvResponse.text();
            console.error(`[DEPLOY] Failed to update env vars: ${errorText}`);
          } else {
            console.log(`[DEPLOY] Environment variables updated successfully`);
          }
        }
        
        // Trigger redeploy
        console.log(`[DEPLOY] Triggering redeploy: ${serviceId}`);
        
        const redeployResponse = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${renderApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clearCache: 'clear',
          }),
        });
        
        if (!redeployResponse.ok) {
          throw new Error(`Failed to trigger redeploy: ${redeployResponse.statusText}`);
        }
        
        serviceUrl = existingService.service.serviceDetails.url;
      }
    }
    
    // Create new service if it doesn't exist or was deleted
    if (!serviceId) {
      // Create new service
      console.log('[DEPLOY] Creating new Render service...');
      
      const createResponse = await fetch('https://api.render.com/v1/services', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${renderApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'web_service',
          name: renderServiceName,
          ownerId: process.env.RENDER_OWNER_ID,
          repo: `https://github.com/${user.login}/${repoName}`,
          autoDeploy: 'yes',
          branch: 'main',
          envVars: Object.entries(env).map(([key, value]) => ({
            key,
            value,
          })),
          serviceDetails: {
            env: 'node',
            plan: 'free',
            region: 'oregon',
            buildCommand: buildCommand,
            startCommand: 'npm start',
            envSpecificDetails: {
              buildCommand: buildCommand,
              startCommand: 'npm start',
            },
          },
        }),
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create Render service: ${createResponse.statusText} - ${errorText}`);
      }
      
      const serviceData = await createResponse.json();
      serviceId = serviceData.service.id;
      serviceUrl = serviceData.service.serviceDetails.url;
      console.log(`[DEPLOY] Service created: ${serviceId}`);
    }
    
    // Clean up
    await fs.rm(deployDir, { recursive: true, force: true });
    console.log('[DEPLOY] Cleaned up temp directory');
    
    res.json({
      success: true,
      url: serviceUrl || `https://${renderServiceName}.onrender.com`,
      appName,
      serviceId,
      repoUrl: repo.html_url,
    });
    
  } catch (error) {
    console.error('[DEPLOY] Deployment failed:', error);
    
    // Clean up on error
    try {
      await fs.rm(deployDir, { recursive: true, force: true });
    } catch {}
    
    res.status(500).json({
      error: 'Deployment failed',
      message: error.message,
      details: error.stack,
    });
  }
});

/**
 * Generate fly.toml configuration
 */
function generateFlyToml(appName, region, env) {
  const envVars = Object.entries(env)
    .map(([key, value]) => `  ${key} = "${value}"`)
    .join('\n');
  
  return `
app = "${appName}"
primary_region = "${region}"

[build]

[env]
${envVars || '  # No environment variables'}

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
`.trim();
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Deployment Worker running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Deploy endpoint: POST http://localhost:${PORT}/deploy`);
  console.log(`📦 Using GitHub + Render deployment strategy`);
});
