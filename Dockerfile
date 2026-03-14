FROM node:18-alpine

# Install git (required for GitHub operations)
RUN apk add --no-cache git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application
COPY server.js ./

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
