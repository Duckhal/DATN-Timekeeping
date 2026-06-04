FROM node:20-alpine

WORKDIR /app

# Install dependencies first to leverage Docker cache, and only copy source files later to avoid unnecessary npm install on every code change
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies using npm ci for a clean install based on package-lock.json
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the NestJS application
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]