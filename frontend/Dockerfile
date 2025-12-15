FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 5173

# Use vite dev server for hot-reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
