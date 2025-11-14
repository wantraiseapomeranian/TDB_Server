# 🏥 TDB 서버 (TDB_Server)

[![NestJS](https://img.shields.io/badge/NestJS-v10-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TypeORM](https://img.shields.io/badge/TypeORM-v0.3-F26B43?style=flat-square)](https://typeorm.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

---

## 📋 프로젝트 개요 (Overview)

**TDB 서버**는 스마트 약 디스펜서 시스템의 백엔드입니다. **React Native 모바일 앱**과 **라즈베리파이 하드웨어** 클라이언트를 모두 지원하며, 다음과 같은 목표를 가집니다.

- **통합 관리**: 앱과 디바이스(라즈베리파이)의 데이터를 중앙에서 관리합니다.
- **실시간 동기화**: 복용 스케줄, 약물 정보, 기기 상태 등을 실시간으로 동기화합니다.
- **모듈화된 구조**: NestJS의 모듈 시스템을 활용하여 기능별(인증, 사용자, 약물, 스케줄 등)로 코드를 분리하고 유지보수성을 높입니다.
- **보안**: JWT 기반의 인증 시스템을 통해 안전한 API 접근을 보장합니다.

## ✨ 주요 기능 (Features)

### 📱 모바일 앱 지원 (For Mobile App)
- **사용자 및 가족 관리**: 부모-자녀 관계의 가족 그룹을 생성하고 관리합니다.
- **인증**: JWT (Access/Refresh Token) 기반의 안전한 로그인, 로그아웃, 회원가입을 지원합니다.
- **약물 및 영양제 관리**: 복용할 약물과 영양제를 등록하고, 재고를 관리합니다.
- **복용 스케줄 설정**: 요일과 시간대(아침/점심/저녁)에 따라 복용 스케줄을 설정합니다.
- **복용 기록 및 통계**: 일간/주간 복용 기록을 확인하고, 통계를 통해 복용률을 추적합니다.
- **알림**: 복용 시간, 약물 재고 부족 시 푸시 알림을 전송합니다.

### 🤖 라즈베리파이 지원 (For Raspberry Pi)
- **기기 인증**: 기기 고유 ID와 Secret Key를 통해 JWT 토큰을 발급받아 API에 접근합니다.
- **RFID 사용자 인증**: RFID(k_uid) 태깅 시 사용자를 식별하고, 해당 사용자의 복용 스케줄을 조회합니다.
- **자동 약 배출**: RFID 인증 및 현재 시간대에 맞춰 자동으로 약을 배출합니다.
- **상태 보고**: 기기 상태(Heartbeat), 배출 결과, 에러 등을 서버로 보고합니다.
- **설정 동기화**: 서버로부터 최신 설정 정보를 받아와 디바이스 동작을 제어합니다.

## 🛠️ 기술 스택 (Tech Stack)

- **Backend**: NestJS (TypeScript), TypeORM
- **Database**: MySQL
- **Authentication**: Passport.js, JWT (JSON Web Token)
- **API Documentation**: Swagger (자동 생성)
- **Deployment**: Docker, PM2, AWS EC2
- **Linting/Formatting**: ESLint, Prettier

## 🏗️ 프로젝트 구조 (Project Structure)

```
src/
├── app.module.ts        # Root Module
├── main.ts              # Application Bootstrap
│
├── auth/                # 👤 인증 (로그인, 회원가입, JWT)
├── users/               # 👨‍👩‍👧‍👦 사용자 및 그룹 관리
├── family/              # 👪 가족 구성원 관리
│
├── machine/             # 🔩 디스펜서 기기 등록 및 상태 관리
├── device/              # 📡 기기 이벤트 및 로그 수신 (신규 API)
├── dispenser/           # 💊 약 배출 로직 (구 API)
├── dispense/            # ✅ 약 배출 결과 보고 (신규 API)
├── rfid/                # 💳 RFID 사용자 식별 (신규 API)
├── queue/               # რი 배출 대기열 생성 (신규 API)
│
├── medicine/            # 🩹 약물 정보 관리
├── supplement/          # 🍊 영양제 정보 관리
├── schedule/            # 🗓️ 복용 스케줄 관리
├── dose-history/        # 📈 복용 기록 및 통계
│
├── notification/        # 🔔 알림 (복용 시간, 재고 부족)
├── health/              # 🩺 서버 상태 체크 (Terminus)
└── config/              # ⚙️ 환경설정 (CORS 등)
```

## 🚀 시작하기 (Getting Started)

### 1. 사전 준비 (Prerequisites)
- [Node.js](https://nodejs.org/) (v18 이상 권장)
- [Docker](https://www.docker.com/) (선택 사항, DB 구동용)
- [MySQL](https://www.mysql.com/) 또는 Docker를 이용한 MySQL 환경

### 2. 설치 (Installation)
```bash
# 1. 프로젝트 클론
git clone https://github.com/wantraiseapomeranian/TDB_Server.git
cd TDB_Server

# 2. 패키지 설치
npm install
```

### 3. 환경변수 설정 (Environment Variables)
`.env` 파일을 프로젝트 루트에 생성하고 아래 내용을 채워주세요.
```env
# Server
PORT=3000
NODE_ENV=development

# Database (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_db_password
DB_DATABASE=TDB

# JWT
JWT_SECRET=your_jwt_secret_key
HASH_ROUNDS=10
```

### 4. 데이터베이스 설정 (Database Setup)
- `TDB`라는 이름의 데이터베이스를 생성해야 합니다.
- TypeORM의 `synchronize` 옵션이 `false`로 설정되어 있으므로, 초기 스키마는 직접 생성해야 합니다. (관련 SQL 파일 필요)

### 4. 애플리케이션 실행 (Running the App)
```bash
# 개발 모드 (파일 변경 시 자동 재시작)
npm run start:dev

# 프로덕션 모드
npm run build
npm run start:prod
```
서버가 정상적으로 실행되면 `http://localhost:3000`에서 접속할 수 있습니다.

## 🌐 API 엔드포인트 (API Endpoints)

서버 실행 후 `http://localhost:3000/api` 경로에서 Swagger UI를 통해 모든 API 명세를 확인할 수 있습니다.

### 주요 API
- **인증**: `POST /api/auth/login`, `POST /api/auth/register`
- **기기 인증**: `POST /api/auth/device/login`
- **사용자 정보**: `GET /api/users/{id}`
- **가족 구성원**: `GET /api/family/members/{userId}`
- **약물 관리**: `GET /api/medicine/list/{userId}`, `POST /api/medicine`
- **스케줄 관리**: `POST /api/schedule/medicine/{medicineId}/{memberId}`
- **복용 기록**: `GET /api/dose-history/history/{userId}`
- **기기 상태**: `GET /api/machine/status/{machineId}`

### 라즈베리파이용 신규 API
- **RFID 사용자 식별**: `POST /api/rfid/resolve`
- **배출 대기열 생성**: `POST /api/queue/build`
- **배출 결과 보고**: `POST /api/dispense/report`
- **기기 이벤트/로그**: `POST /api/device/event`
- **기기 하트비트**: `POST /api/machine/heartbeat`

## 🐳 도커 (Docker)

프로젝트에 포함된 `Dockerfile`과 `docker-compose.yml`을 사용하여 Docker 컨테이너로 서버를 실행할 수 있습니다.

```bash
# Docker 이미지 빌드
docker build -t tdb-server .

# Docker Compose로 실행 (DB 포함)
docker-compose up -d
```

## 📜 스크립트 (Scripts)

- `npm run start`: NestJS 앱 시작
- `npm run start:dev`: 개발 모드로 실행
- `npm run build`: 프로덕션용으로 빌드
- `npm run format`: Prettier로 코드 포맷팅
- `npm run lint`: ESLint로 코드 검사
- `npm run test`: Jest로 유닛 테스트 실행