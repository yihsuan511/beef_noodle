# 選擇 Node.js 官方映像作為基礎
# 使用長期支援 (LTS) 版本，並且是 slim 版以減少映像大小
FROM node:18-alpine

# 設定工作目錄
# 所有後續的命令都將在這個目錄中執行
WORKDIR /app

# 將 package.json 和 package-lock.json (或 yarn.lock) 複製到工作目錄
# 這一步單獨複製是為了利用 Docker 的快取機制
# 如果這兩個檔案沒有改變，npm install 步驟就不會重新執行
COPY package*.json ./

# 安裝專案依賴
# --production 參數會只安裝 package.json 中 dependencies 的套件，不包括 devDependencies
RUN npm install --production

# 將所有剩餘的應用程式原始碼複製到工作目錄
# .dockerignore 會在這裡發揮作用，排除不需要的檔案
COPY . .

# 如果您的 Node.js 應用程式監聽特定的埠號，請在此處暴露
# 根據您的程式碼，您的伺服器運行在 process.env.PORT 或 3000
EXPOSE 3000

# 定義容器啟動時執行的命令
# 這裡假設您的主應用程式檔案是 server.js
CMD ["node", "server.js"]
