# Trigger Build 17
FROM node:20-alpine
WORKDIR /app

ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV NODE_ENV=production

# 1. Copy only package configuration to verify cache
COPY package*.json ./

# 2. Install dependencies with persistent npm cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm ci --include=dev

# 3. Copy source files
COPY . .

# 4. Compile Next.js with persistent compiler cache mount
RUN --mount=type=cache,target=/app/.next/cache npm run build

EXPOSE 3000
CMD ["npm", "start"]
