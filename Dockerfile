FROM node:20-alpine

WORKDIR /app/railway/aira-brain

COPY railway/aira-brain/package*.json ./
COPY railway/aira-brain/tsconfig.json ./

RUN npm install

COPY railway/aira-brain/src ./src
RUN npm run build

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
