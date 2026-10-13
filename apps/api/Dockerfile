FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages packages
COPY apps apps
RUN npm ci
RUN npm run build -w @ainews/shared && npm run build -w @ainews/db && npm run build -w @ainews/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
