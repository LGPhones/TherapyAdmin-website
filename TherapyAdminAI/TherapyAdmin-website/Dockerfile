# Use official Node.js lightweight Alpine image
FROM node:18-alpine

# Set environment context
ENV NODE_ENV=production

# Set working directory inside the container
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install ONLY production dependencies (excludes local devDependencies)
RUN npm ci --only=production

# Copy remaining source code
COPY . .

# Expose port 3000
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
