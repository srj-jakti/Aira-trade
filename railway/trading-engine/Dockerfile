FROM node:20-alpine

RUN apk add --no-cache libatomic

WORKDIR /app/railway/trading-engine

COPY railway/trading-engine/package*.json ./
RUN npm install

COPY railway/trading-engine/ ./
COPY src/lib/zairoth /app/src/lib/zairoth
COPY src/lib/types /app/src/lib/types
RUN npm run build

CMD ["node", "dist/engine.js"]
