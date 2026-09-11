# SmartScout Research — production image for Dokploy
# Monorepo: root npm workspaces (smartscout-mcp + web). The web app transpiles
# smartscout-mcp's TypeScript source, so the whole workspace must be installed
# and built together.

# ---- build stage ----
FROM node:20-slim AS build
WORKDIR /app

# install workspace deps from the lockfile (needs all workspace manifests)
COPY package.json package-lock.json ./
COPY smartscout-mcp/package.json ./smartscout-mcp/package.json
COPY web/package.json ./web/package.json
RUN npm ci

# copy the rest and build the web app (next/font fetches fonts at build time)
COPY . .
RUN npm run build --workspace web

# drop dev dependencies so the runtime image is lean
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
# Next.js reads PORT; Dokploy injects it. Default to 3000.
ENV PORT=3000

# bring over the built workspace + pruned node_modules
COPY --from=build /app ./

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "web"]
