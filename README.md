# Deployment Worker Service

A microservice that handles backend deployments using GitHub + Render (no credit card required).

## Architecture

```
User's Browser
    ↓
Your Main App (Cloudflare Workers)
    ↓ POST /deploy with files
Deployment Worker (this service)
    ↓ Creates GitHub repo & pushes code
GitHub Repository
    ↓ Triggers deployment
Render (user's deployed app)
```

## Why GitHub + Render?

- ✅ No credit card required (both free tiers)
- ✅ Full Express.js support
- ✅ Automatic deployments from Git
- ✅ Free SSL certificates
- ✅ 750 hours/month free tier

## Setup

### 1. Install Dependencies
```bash
cd deployment-worker
npm install
```

### 2. Get GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` (Full control of private repositories)
   - `delete_repo` (Delete repositories - optional)
4. Copy the token

### 3. Get Render API Key

1. Go to https://dashboard.render.com/
2. Sign up/login (no credit card needed)
3. Go to Account Settings → API Keys
4. Create new API key
5. Copy the key

### 4. Get Render Owner ID

```bash
# Using the API key from step 3
curl -H "Authorization: Bearer YOUR_RENDER_API_KEY" \
  https://api.render.com/v1/owners
```

Copy the `id` field from the response.

### 5. Set Environment Variables

Create a `.env` file:
```bash
GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
RENDER_API_KEY="rnd_xxxxxxxxxxxxxxxxxxxx"
RENDER_OWNER_ID="own-xxxxxxxxxxxxxxxxxxxx"
PORT=3000
```

### 6. Run Locally
```bash
npm run dev
```

### 7. Test
```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "appName": "test-app-123",
    "files": [
      {
        "path": "package.json",
        "content": "{\"name\":\"test\",\"version\":\"1.0.0\",\"scripts\":{\"start\":\"node index.js\"}}"
      },
      {
        "path": "index.js",
        "content": "const express = require(\"express\");\nconst app = express();\napp.get(\"/\", (req, res) => res.send(\"Hello World\"));\napp.listen(process.env.PORT || 3000);"
      }
    ],
    "env": {
      "NODE_ENV": "production"
    }
  }'
```

## Deploy the Worker Itself

### Option 1: Deploy to Render (Recommended - No Card Required)

1. Push this code to a GitHub repository
2. Go to https://dashboard.render.com/
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - Name: `deployment-worker`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Add environment variables:
   - `GITHUB_TOKEN`
   - `RENDER_API_KEY`
   - `RENDER_OWNER_ID`
7. Click "Create Web Service"
8. Wait for deployment (5-10 minutes)
9. Get your URL: `https://deployment-worker.onrender.com`

### Option 2: Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway up

# Set environment variables
railway variables set GITHUB_TOKEN="your-token"
railway variables set RENDER_API_KEY="your-key"
railway variables set RENDER_OWNER_ID="your-id"
```

### Option 3: Run on Your Own Server

```bash
# Install Node.js and Git
# Clone this repository
git clone <your-repo>
cd deployment-worker

# Install dependencies
npm install

# Set environment variables
export GITHUB_TOKEN="your-token"
export RENDER_API_KEY="your-key"
export RENDER_OWNER_ID="your-id"

# Run with PM2 (process manager)
npm install -g pm2
pm2 start server.js --name deployment-worker
pm2 save
```

## Usage from Your Main App

Update your deployment route to call this service:

```typescript
// app/routes/api.deploy.ts
export async function action({ request, context }: ActionFunctionArgs) {
  // ... authentication and validation ...
  
  const response = await fetch('https://your-deployment-worker.onrender.com/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appName: `app-${projectId.substring(0, 8)}`,
      files: exportedFiles,
      env: environmentVariables,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Deployment failed');
  }
  
  const result = await response.json();
  // result.url - deployed app URL
  // result.repoUrl - GitHub repository URL
  // result.serviceId - Render service ID
}
```

## How It Works

1. **Receive Files**: Worker receives project files via API
2. **Create GitHub Repo**: Creates a new repository (or uses existing)
3. **Push Code**: Initializes git, commits, and pushes to GitHub
4. **Create Render Service**: Creates a new Render web service linked to the repo
5. **Auto Deploy**: Render automatically builds and deploys from GitHub
6. **Return URL**: Returns the deployed app URL

## Security

### API Key Authentication (Recommended)

Add authentication to prevent unauthorized deployments:

```javascript
// In server.js, add before app.post('/deploy', ...)
const API_KEY = process.env.DEPLOYMENT_API_KEY;

app.use('/deploy', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

Then set the environment variable:
```bash
export DEPLOYMENT_API_KEY="your-secret-key"
```

## Cost

- **GitHub**: Free (unlimited public repositories)
- **Render Free Tier**: 
  - 750 hours/month per service
  - Auto-sleep after 15 minutes of inactivity
  - Cold start: ~30 seconds
  - No credit card required
- **Deployment Worker**: Free on Render (uses ~1 hour/month)

## Monitoring

### Check Render Logs
```bash
# Via API
curl -H "Authorization: Bearer YOUR_RENDER_API_KEY" \
  https://api.render.com/v1/services/YOUR_SERVICE_ID/logs
```

### Check Worker Logs
If deployed on Render, view logs in the dashboard or via API.

## Troubleshooting

### Git not found
Make sure git is installed:
```bash
# On Ubuntu/Debian
apt-get install git

# On macOS
brew install git

# On Windows
# Download from https://git-scm.com/
```

### GitHub authentication failed
- Check that GITHUB_TOKEN is valid
- Token needs `repo` scope
- Try regenerating the token

### Render API errors
- Verify RENDER_API_KEY is correct
- Check RENDER_OWNER_ID matches your account
- Ensure you're not hitting rate limits

### Service already exists
The worker will automatically redeploy existing services. If you want to delete and recreate:
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_RENDER_API_KEY" \
  https://api.render.com/v1/services/YOUR_SERVICE_ID
```

## Limitations

- **Cold Starts**: Free tier services sleep after 15 minutes of inactivity
- **Build Time**: First deployment takes 5-10 minutes
- **Concurrent Builds**: Free tier has limited concurrent builds
- **Storage**: 1GB disk space per service

## Next Steps

1. Deploy this worker to Render (no card needed)
2. Get the worker's URL (e.g., `https://deployment-worker.onrender.com`)
3. Update your main app to use this URL
4. Test end-to-end deployment
5. Add authentication for security
6. Monitor deployments via Render dashboard

## Alternative: Direct Render Deployment

If you don't want to use GitHub, you can deploy directly to Render using their Archive API (similar to what we tried with Koyeb). However, this requires more complex setup and isn't as reliable as the Git-based approach.
