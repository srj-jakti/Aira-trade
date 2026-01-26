FROM node:20-alpine

RUN apk add --no-cache libatomic

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["node", "dist/engine.js"]
