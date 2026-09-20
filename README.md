# 偕裳 XieShang

偕裳是一个面向服装虚拟试穿与个性化场景推荐的演示项目。项目采用前后端分离架构：前端提供移动端 App 风格页面，包括首页试穿、衣橱、发现和我的；后端基于 FastAPI 提供用户会话、衣橱、搭配、试穿记录、发现页互动以及 AI 试穿流程接口。

## 拉取项目

```bash
git clone https://github.com/LeoMjl/XieShang.git
cd XieShang
```

## 配置项目

### 1. 基础环境

请先安装：

- Git
- Docker Desktop
- Python 3.11 或更高版本
- Node.js 20 或更高版本
- npm

### 2. 配置后端环境变量

复制环境变量模板：

```bash
cp .env.example backend/.env
```

Windows PowerShell：

```powershell
Copy-Item .env.example backend/.env
```

编辑 `backend/.env`，至少配置以下内容：

```env
ALIYUN_API_KEY=
DASHSCOPE_API_KEY=
DATABASE_URL=postgresql://xieshang_user:xieshang_password@localhost:5432/xieshang_db
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
```

### 3. 安装后端依赖

```bash
cd backend
python -m venv venv
```

Windows PowerShell：

```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

macOS/Linux：

```bash
source venv/bin/activate
pip install -r requirements.txt
```

### 4. 安装前端依赖

```bash
cd ../frontend
npm install
```

如需指定后端地址，可在 `frontend` 目录创建 `.env`：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 运行项目

### 1. 启动数据库

在项目根目录执行：

```bash
docker compose up -d
```

### 2. 启动后端

```bash
cd backend
```

Windows PowerShell：

```powershell
.\start_backend.ps1
```

脚本会先检查 8000 端口：如果本项目后端已经运行，则不会重复启动；需要重新加载后端代码时执行 `.\start_backend.ps1 -Restart`。如果端口由其他程序占用，脚本只报告进程信息，不会误杀其他程序。

macOS/Linux：

```bash
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端地址：

```text
http://127.0.0.1:8000
```

### 生成 Windows 比赛提交包

在项目根目录执行：

```powershell
.\build_windows_release.ps1
```

脚本会编译前端、生成 Windows 64 位可执行程序，并输出 `release/XieShang-Windows-x64.zip`。发行包不会包含 `backend/.env` 或真实 API Key；具体运行和密钥配置方式见 `docs/EXECUTABLE_GUIDE.md`。

接口文档：

```text
http://127.0.0.1:8000/docs
```

### 3. 启动前端

打开新的终端：

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

前端访问地址：

```text
http://127.0.0.1:3000
```

### 4. 常用检查命令

前端构建：

```bash
cd frontend
npm run build
```

停止数据库：

```bash
docker compose down
```
