# Quick Setup Guide

Follow these steps to get the deployment worker running.

## Step 1: Get GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name: "Deployment Worker"
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)

Example: `ghp_1234567890abcdefghijklmnopqrstuvwxyz`

## Step 2: Get Render API Key

1. Go to https://dashboard.render.com/
2. Sign up or login (no credit card needed!)
3. Click your profile → "Account Settings"
4. Go to "API Keys" tab
5. Click "Create API Key"
6. Give it a name: "Deployment Worker"
7. **Copy the key**

Example: `rnd_1234567890abcdefghijklmnopqrstuvwxyz`

## Step 3: Get Render Owner ID

Run this command (replace with your API key):

```bash
curl -H "Authorization: Bearer rnd_YOUR_API_KEY_HERE" \
  https://api.render.com/v1/owners
```

You'll get a response like:
```json
[
  {
    "id": "own-abc123xyz",
    "name": "Your Name",
    "email": "you@example.com"
  }
]
```

**Copy the `id` field**: `own-abc123xyz`

## Step 4: Configure Environment Variables

Create a `.env` file in the `deployment-worker` folder:

```bash
GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz
RENDER_API_KEY=rnd_1234567890abcdefghijklmnopqrstuvwxyz
RENDER_OWNER_ID=own-abc123xyz
PORT=3000
```

## Step 5: Install and Run

```bash
# Install dependencies
npm install

# Run the worker
npm start
```

You should see:
```
🚀 Deployment Worker running on port 3000
📡 Health check: http://localhost:3000/health
🔧 Deploy endpoint: POST http://localhost:3000/deploy
📦 Using GitHub + Render deployment strategy
```

## Step 6: Test It

Open a new terminal and run:

```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "appName": "test-hello-world",
    "files": [
      {
        "path": "package.json",
        "content": "{\"name\":\"test\",\"version\":\"1.0.0\",\"scripts\":{\"start\":\"node index.js\"},\"dependencies\":{\"express\":\"^4.18.2\"}}"
      },
      {
        "path": "index.js",
        "content": "const express = require(\"express\");\nconst app = express();\napp.get(\"/\", (req, res) => res.send(\"Hello from Render!\"));\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(`Server running on port ${PORT}`));"
      }
    ]
  }'
```

If successful, you'll get:
```json
{
  "success": true,
  "url": "https://test-hello-world.onrender.com",
  "appName": "test-hello-world",
  "serviceId": "srv-...",
  "repoUrl": "https://github.com/yourusername/deploy-test-hello-world"
}
```

## Step 7: Deploy the Worker to Render

Now deploy the worker itself so your main app can use it:

1. Create a GitHub repository for the deployment-worker
2. Push the code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/deployment-worker.git
   git push -u origin main
   ```

3. Go to https://dashboard.render.com/
4. Click "New +" → "Web Service"
5. Connect your GitHub repository
6. Configure:
   - **Name**: `deployment-worker`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

7. Add environment variables (click "Advanced"):
   - `GITHUB_TOKEN` = your GitHub token
   - `RENDER_API_KEY` = your Render API key
   - `RENDER_OWNER_ID` = your Render owner ID

8. Click "Create Web Service"

9. Wait 5-10 minutes for deployment

10. Get your URL: `https://deployment-worker.onrender.com`

## Step 8: Update Your Main App

Update your main app to use the deployment worker URL:

```typescript
// In your main app's deployment code
const DEPLOYMENT_WORKER_URL = 'https://deployment-worker.onrender.com';

const response = await fetch(`${DEPLOYMENT_WORKER_URL}/deploy`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appName: `app-${projectId.substring(0, 8)}`,
    files: exportedFiles,
    env: environmentVariables,
  }),
});
```

## Troubleshooting

### "GITHUB_TOKEN not configured"
- Make sure you set the environment variable correctly
- Check the token has `repo` scope
- Try regenerating the token

### "RENDER_API_KEY not configured"
- Verify the API key is correct
- Make sure it's not expired
- Try creating a new API key

### "Failed to create Render service"
- Check RENDER_OWNER_ID is correct
- Verify your Render account is active
- Check the error message for details

### Git errors
- Make sure git is installed: `git --version`
- On Ubuntu: `sudo apt-get install git`
- On macOS: `brew install git`

### Port already in use
- Change the PORT in .env file
- Or kill the process: `lsof -ti:3000 | xargs kill`

## Next Steps

- Add authentication to the worker (see README.md)
- Monitor deployments in Render dashboard
- Set up automatic redeployments
- Configure custom domains in Render

## Support

If you run into issues:
1. Check the worker logs: `npm start` output
2. Check Render logs in the dashboard
3. Verify all environment variables are set
4. Test with the simple curl command first
