FROM node:20-alpine

WORKDIR /app

# Install dependencies first to leverage Docker cache
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies using npm ci for a clean install
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the NestJS application (Nest CLI sẽ ăn theo outDir chuẩn vừa sửa ở trên)
RUN npm run build

# Debug: List the contents of the dist directory to verify the build output
RUN ls -la /app/dist

EXPOSE 3000

# SỬA DÒNG NÀY: Bỏ prisma migrate deploy, chạy trực tiếp file main bằng node
CMD ["node", "dist/src/main.js"]