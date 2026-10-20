FROM node:20
WORKDIR /app
COPY . .
RUN npm install
RUN chmod +x startup.sh
EXPOSE 8080
CMD ["./startup.sh"]
