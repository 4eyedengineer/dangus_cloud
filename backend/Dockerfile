FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY backend/package*.json ./
RUN npm install

# Copy source code
COPY backend/src ./src
COPY backend/migrations ./migrations

# Copy templates
COPY templates ./templates

EXPOSE 3001

# Use nodemon for hot-reload in development
CMD ["npm", "run", "dev"]
