# Используем лёгкий Node
FROM node:20-alpine

# Рабочая директория в контейнере
WORKDIR /app

# Копируем package.json и package-lock.json из локальной папки app
COPY app/package*.json ./

# Устанавливаем зависимости
RUN npm install --production

# Копируем весь код проекта
COPY app/ ./

# Экспонируем порт
EXPOSE 3000

# Запуск сервера
CMD ["npm", "start"]
