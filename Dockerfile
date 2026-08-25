# Stage 1: Build the React application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Pass build-time environment variables
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the production bundle
RUN npm run build

# Stage 2: Packaging the static files
FROM alpine:latest
WORKDIR /app

# Copy the build output from the builder stage
COPY --from=builder /app/dist ./dist
