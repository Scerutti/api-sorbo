# --- Build Stage ---
  FROM node:20-alpine AS builder

  # Seguridad básica
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  
  WORKDIR /usr/src/app
  
  # Solo copio package.json y lock para aprovechar la cache
  COPY package*.json ./
  
  # Instalo dependencias (sin dev si no las necesitas en prod)
  # Usar --legacy-peer-deps para evitar conflictos de peer dependencies
  RUN npm install --legacy-peer-deps
  
  # Copio el resto del código
  COPY . .
  
  # Compilo con SWC (o tsc si usás TS normal)
  RUN npm run build
  
  # --- Runtime Stage ---
  FROM node:20-alpine AS runner
  
  # Seguridad: user sin privilegios
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  WORKDIR /usr/src/app
  
  # Copio solo lo necesario desde build
  COPY --from=builder /usr/src/app/package*.json ./
  COPY --from=builder /usr/src/app/node_modules ./node_modules
  COPY --from=builder /usr/src/app/dist ./dist
  
  # Variables por defecto (podés pisarlas con tu .env en Railway)
  ENV NODE_ENV=production
  ENV PORT=8080
  
  # Exponer puerto
  EXPOSE 8080
  
  # Usuario sin root
  USER appuser
  
  # Ejecutar el servicio
  CMD ["node", "dist/main.js"]