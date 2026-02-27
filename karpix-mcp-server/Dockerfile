FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV KARPIX_API_KEY=""
ENV KARPIX_BASE_URL="http://localhost:8080"
ENV MCP_TRANSPORT="sse"
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
