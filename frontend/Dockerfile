FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Add entrypoint script to generate .env from k8s env vars
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 5173

ENTRYPOINT ["/app/entrypoint.sh"]
# Use vite dev server for hot-reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
