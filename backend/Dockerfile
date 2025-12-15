FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 3001

# Use nodemon for hot-reload in development
CMD ["npm", "run", "dev"]
