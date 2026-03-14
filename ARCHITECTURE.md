# Deployment Worker Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Main App UI (React)                                      │  │
│  │  - User creates Express.js app                            │  │
│  │  - Clicks "Deploy Backend" button                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                │ HTTP POST /api/deploy
                                │ { projectId, files, env }
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN APP (Cloudflare Workers)                 │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  app/routes/api.deploy.ts                                 │  │
│  │  - Validates user authentication                          │  │
│  │  - Exports project files                                  │  │
│  │  - Calls deployment worker                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                │ HTTP POST /deploy
                                │ { appName, files, env }
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              DEPLOYMENT WORKER (Node.js on Render)               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  server.js                                                │  │
│  │  1. Receive files                                         │  │
│  │  2. Create temp directory                                 │  │
│  │  3. Write files to disk                                   │  │
│  │  4. Initialize git repository                             │  │
│  │  5. Create GitHub repo (via Octokit)                      │  │
│  │  6. Push code to GitHub                                   │  │
│  │  7. Create/update Render service                          │  │
│  │  8. Return deployed URL                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────┬───────────────────────────┬───────────────────────┘
                │                           │
                │ GitHub API                │ Render API
                │ (Octokit)                 │ (REST)
                ▼                           ▼
┌─────────────────────────┐   ┌─────────────────────────────────┐
│       GITHUB            │   │          RENDER                  │
│                         │   │                                  │
│  Repository Created:    │   │  Web Service Created:            │
│  deploy-{appName}       │───┼─▶ Linked to GitHub repo         │
│                         │   │  Auto-deploy enabled             │
│  Code pushed to main    │   │  Build: npm install              │
│  branch                 │   │  Start: npm start                │
└─────────────────────────┘   └──────────────┬───────────────────┘
                                             │
                                             │ Automatic Build
                                             │ & Deployment
                                             ▼
                              ┌─────────────────────────────────┐
                              │    DEPLOYED APPLICATION         │
                              │                                 │
                              │  URL: {appName}.onrender.com    │
                              │  Status: Live                   │
                              │  SSL: Automatic                 │
                              └─────────────────────────────────┘
```

## Component Details

### 1. Main App (Cloudflare Workers)

**Role:** Frontend and API gateway

**Responsibilities:**
- User authentication
- Project file management
- Deployment request coordination
- Database persistence

**Key Files:**
- `app/routes/api.deploy.ts` - Deployment API endpoint
- `app/components/cloud/DeployView.client.tsx` - UI component

**Environment Variables:**
- `DEPLOYMENT_WORKER_URL` - URL of deployment worker

### 2. Deployment Worker (Node.js)

**Role:** Deployment orchestration service

**Responsibilities:**
- Receive project files
- Create GitHub repositories
- Push code to GitHub
- Create Render services
- Handle deployment errors

**Key Files:**
- `server.js` - Main Express server
- `package.json` - Dependencies (express, cors, @octokit/rest)
- `Dockerfile` - Container configuration

**Environment Variables:**
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `RENDER_API_KEY` - Render API key
- `RENDER_OWNER_ID` - Render account owner ID
- `PORT` - Server port (default: 3000)

**API Endpoints:**
- `GET /health` - Health check
- `POST /deploy` - Deploy application

### 3. GitHub

**Role:** Source code repository

**Responsibilities:**
- Store application code
- Version control
- Trigger Render deployments

**Repository Format:**
- Name: `deploy-{appName}`
- Visibility: Public (default)
- Branch: main
- Auto-created by worker

### 4. Render

**Role:** Application hosting platform

**Responsibilities:**
- Build application (npm install)
- Run application (npm start)
- Provide HTTPS endpoint
- Auto-deploy on git push

**Service Configuration:**
- Type: Web Service
- Environment: Node
- Plan: Free (750 hours/month)
- Auto-deploy: Enabled
- Region: Oregon (default)

## Data Flow

### Deployment Request Flow

```
1. User Action
   └─▶ Click "Deploy Backend" button

2. Main App Processing
   ├─▶ Validate authentication
   ├─▶ Export project files
   ├─▶ Prepare environment variables
   └─▶ Send to deployment worker

3. Worker Processing
   ├─▶ Validate request
   ├─▶ Create temp directory
   ├─▶ Write files to disk
   ├─▶ Initialize git
   ├─▶ Create GitHub repo
   ├─▶ Push to GitHub
   ├─▶ Create Render service
   └─▶ Return deployed URL

4. GitHub Processing
   ├─▶ Receive code push
   ├─▶ Store in repository
   └─▶ Trigger webhook to Render

5. Render Processing
   ├─▶ Detect new commit
   ├─▶ Clone repository
   ├─▶ Run npm install
   ├─▶ Run npm start
   └─▶ Expose HTTPS endpoint

6. Response Flow
   └─▶ Worker → Main App → User Browser
       (Deployed URL displayed)
```

## Security Architecture

### Authentication Chain

```
User
  │ Session Cookie
  ▼
Main App
  │ API Key (optional)
  ▼
Deployment Worker
  │ GitHub Token
  ▼
GitHub API
  │ Render API Key
  ▼
Render API
```

### Token Scopes

**GitHub Token:**
- `repo` - Full control of repositories
- Used for: Creating repos, pushing code

**Render API Key:**
- Full account access
- Used for: Creating services, triggering deploys

### Security Best Practices

1. **Environment Variables**
   - Store all tokens in environment
   - Never commit to git
   - Use .env for local development
   - Use Render secrets for production

2. **API Authentication**
   - Add API key to worker (optional)
   - Validate requests from main app
   - Rate limit deployment requests

3. **Token Rotation**
   - Rotate GitHub token every 90 days
   - Rotate Render API key periodically
   - Update environment variables

## Error Handling

### Error Flow

```
Error Occurs
  │
  ├─▶ GitHub API Error
  │   ├─▶ Token invalid → Return 500
  │   ├─▶ Rate limit → Return 429
  │   └─▶ Repo exists → Reuse existing
  │
  ├─▶ Git Command Error
  │   ├─▶ Git not installed → Return 500
  │   ├─▶ Push failed → Retry with force
  │   └─▶ Permission denied → Return 500
  │
  ├─▶ Render API Error
  │   ├─▶ API key invalid → Return 500
  │   ├─▶ Service exists → Trigger redeploy
  │   └─▶ Build failed → Return error details
  │
  └─▶ Cleanup
      └─▶ Remove temp directory
```

### Error Recovery

1. **Temporary Failures**
   - Retry with exponential backoff
   - Clean up resources
   - Return detailed error message

2. **Permanent Failures**
   - Log error details
   - Clean up resources
   - Return user-friendly error

3. **Partial Failures**
   - GitHub created but Render failed
   - Repository remains for manual inspection
   - User can retry deployment

## Scalability

### Current Limits

**Free Tier:**
- GitHub: 5,000 API requests/hour
- Render: 750 hours/month per service
- Worker: 750 hours/month

**Bottlenecks:**
- GitHub API rate limits
- Render build queue
- Worker cold starts (15 min inactivity)

### Scaling Strategies

1. **Horizontal Scaling**
   - Deploy multiple workers
   - Load balance requests
   - Use multiple GitHub accounts

2. **Vertical Scaling**
   - Upgrade Render plan
   - Increase worker memory
   - Use faster build machines

3. **Optimization**
   - Cache GitHub repos
   - Reuse existing services
   - Batch deployments

## Monitoring

### Health Checks

```
Main App
  │ Every 5 minutes
  ▼
GET /health
  │
  ├─▶ 200 OK → Worker healthy
  └─▶ Timeout → Worker down
```

### Metrics to Track

1. **Deployment Metrics**
   - Total deployments
   - Success rate
   - Average deployment time
   - Error rate by type

2. **Resource Metrics**
   - Worker uptime
   - Memory usage
   - CPU usage
   - API rate limit usage

3. **User Metrics**
   - Deployments per user
   - Most deployed apps
   - Peak usage times

## Cost Analysis

### Free Tier Breakdown

```
GitHub (Free)
├─▶ Unlimited public repos
├─▶ 5,000 API requests/hour
└─▶ Cost: $0/month

Render (Free)
├─▶ 750 hours/month per service
├─▶ Auto-sleep after 15 min
├─▶ 100GB bandwidth/month
└─▶ Cost: $0/month

Deployment Worker (Free)
├─▶ Uses ~1-2 hours/month
├─▶ Minimal bandwidth
└─▶ Cost: $0/month

Total: $0/month
```

### Paid Tier (If Needed)

```
GitHub Pro: $4/month
├─▶ Private repositories
└─▶ Advanced features

Render Starter: $7/month per service
├─▶ No auto-sleep
├─▶ Faster builds
└─▶ More resources

Total: ~$11/month
```

## Deployment Timeline

```
User clicks Deploy
  │
  ├─▶ 0-1s: Main app processes request
  │
  ├─▶ 1-2s: Worker receives files
  │
  ├─▶ 2-5s: Create GitHub repo & push
  │
  ├─▶ 5-10s: Create Render service
  │
  ├─▶ 10s-5min: Render builds app
  │   ├─▶ Clone repository
  │   ├─▶ npm install
  │   └─▶ npm start
  │
  └─▶ 5-10min: App is live!
```

**First deployment:** 5-10 minutes
**Subsequent deployments:** 2-5 minutes

## Future Enhancements

### Phase 1: Core Improvements
- [ ] Add deployment status tracking
- [ ] Stream build logs to UI
- [ ] Add rollback capability
- [ ] Implement deployment queue

### Phase 2: Advanced Features
- [ ] Support custom domains
- [ ] Add environment variable management
- [ ] Implement multi-region deployment
- [ ] Add deployment analytics

### Phase 3: Platform Expansion
- [ ] Support Railway
- [ ] Support Vercel
- [ ] Support AWS Amplify
- [ ] Support Azure

## Conclusion

This architecture provides a robust, scalable solution for backend deployment without requiring credit cards. The separation of concerns (main app, worker, GitHub, Render) ensures reliability and maintainability.
