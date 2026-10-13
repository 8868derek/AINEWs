FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages packages
COPY apps apps
RUN npm ci
RUN npm run build -w @ainews/shared && npm run build -w @ainews/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@ainews/web"]
