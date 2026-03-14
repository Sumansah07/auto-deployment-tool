# Quick Start - 5 Minutes to Deploy

## Prerequisites
- Node.js 18+ installed
- Git installed
- GitHub account
- Render account (free, no card needed)

## Step 1: Get Credentials (2 minutes)

### GitHub Token
```
1. Visit: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: "Deployment Worker"
4. Check: ☑ repo
5. Click "Generate token"
6. Copy token: ghp_xxxxx...
```

### Render API Key
```
1. Visit: https://dashboard.render.com/
2. Sign up (no card needed!)
3. Go to: Account Settings → API Keys
4. Click "Create API Key"
5. Name: "Deployment Worker"
6. Copy key: rnd_xxxxx...
```

### Render Owner ID
```bash
# Replace YOUR_KEY with the key from above
curl -H "Authorization: Bearer YOUR_KEY" https://api.render.com/v1/owners
# Copy the "id" field: own_xxxxx...
```

## Step 2: Configure (1 minute)

Create `.env` file:
```bash
GITHUB_TOKEN=ghp_xxxxx...
RENDER_API_KEY=rnd_xxxxx...
RENDER_OWNER_ID=own_xxxxx...
PORT=3000
```

## Step 3: Run (1 minute)

```bash
npm install
npm start
```

You should see:
```
🚀 Deployment Worker running on port 3000
📡 Health check: http://localhost:3000/health
🔧 Deploy endpoint: POST http://localhost:3000/deploy
📦 Using GitHub + Render deployment strategy
```

## Step 4: Test (1 minute)

Open new terminal:

```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d "{\"appName\":\"test-hello\",\"files\":[{\"path\":\"package.json\",\"content\":\"{\\\"name\\\":\\\"test\\\",\\\"version\\\":\\\"1.0.0\\\",\\\"scripts\\\":{\\\"start\\\":\\\"node index.js\\\"},\\\"dependencies\\\":{\\\"express\\\":\\\"^4.18.2\\\"}}\"}},{\"path\":\"index.js\",\"content\":\"const express = require('express');\\nconst app = express();\\napp.get('/', (req, res) => res.send('Hello from Render!'));\\nconst PORT = process.env.PORT || 3000;\\napp.listen(PORT, () => console.log('Server running on port ' + PORT));\"}]}"
```

Wait 5-10 minutes for first deployment, then visit the URL in the response!

## Step 5: Deploy Worker to Render (Optional)

To make it accessible from your main app:

1. Push this code to GitHub
2. Go to https://dashboard.render.com/
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Set environment variables (same as .env)
6. Click "Create Web Service"
7. Get URL: `https://deployment-worker.onrender.com`

## Troubleshooting

**"GITHUB_TOKEN not configured"**
→ Check .env file exists and has correct token

**"RENDER_API_KEY not configured"**
→ Check .env file has correct API key

**"Git command failed"**
→ Install git: https://git-scm.com/

**Port already in use**
→ Change PORT in .env to 3001

## What's Next?

- Read `SETUP_GUIDE.md` for detailed instructions
- Read `README.md` for technical documentation
- Integrate with your main app
- Deploy worker to Render for production use

## Need Help?

Check these files:
- `SETUP_GUIDE.md` - Detailed setup
- `README.md` - Full documentation
- `../docs/GITHUB_RENDER_DEPLOYMENT.md` - Architecture

## Success Checklist

- [ ] Got GitHub token
- [ ] Got Render API key
- [ ] Got Render owner ID
- [ ] Created .env file
- [ ] Ran npm install
- [ ] Started server (npm start)
- [ ] Tested with curl
- [ ] Saw deployed URL
- [ ] Visited deployed app

If all checked, you're ready to integrate with your main app! 🎉
