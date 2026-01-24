FROM oven/bun:1-alpine

WORKDIR /app

# Create cache directory with proper permissions
RUN mkdir -p /app/node_modules/.cache && chmod -R 777 /app/node_modules/.cache

COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bun run build

CMD ["bun", "run", "start"]
