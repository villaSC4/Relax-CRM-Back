FROM node:20-slim

# Instalar dependencias del sistema necesarias para Chromium / Puppeteer en Linux
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       wget \
       gnupg \
       ca-certificates \
       procps \
       libxss1 \
       chromium \
       fonts-ipafont-gothic \
       fonts-wqy-zenhei \
       fonts-thai-tlwg \
       fonts-kacst \
       fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

# Configuración de Puppeteer para usar el Chromium instalado en el sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
