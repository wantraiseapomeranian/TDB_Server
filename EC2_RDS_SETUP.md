# 🚀 EC2 + RDS 배포 가이드

## 📋 목차
1. [사전 준비](#1-사전-준비)
2. [RDS 인스턴스 생성](#2-rds-인스턴스-생성)
3. [보안 그룹 설정](#3-보안-그룹-설정)
4. [EC2에서 RDS 연결](#4-ec2에서-rds-연결)
5. [애플리케이션 배포](#5-애플리케이션-배포)
6. [문제 해결](#6-문제-해결)

---

## 1. 사전 준비

### 필요한 것들:
- ✅ AWS 계정
- ✅ EC2 인스턴스 (이미 있음: `ec2-3-37-87-255.ap-northeast-2.compute.amazonaws.com`)
- ✅ SSH 키 페어 (EC2 접속용)

### EC2 인스턴스 요구사항:
```bash
# Node.js 18+ 설치 확인
node --version

# npm 확인
npm --version

# MySQL 클라이언트 설치 (RDS 연결 테스트용)
# Amazon Linux 2:
sudo yum install mysql -y

# Ubuntu:
sudo apt-get update
sudo apt-get install mysql-client -y
```

---

## 2. RDS 인스턴스 생성

### AWS Console에서:

1. **RDS 대시보드** 이동
   - URL: https://console.aws.amazon.com/rds/

2. **"데이터베이스 생성"** 클릭

3. **기본 설정:**
   ```
   엔진 옵션: MySQL
   버전: MySQL 8.0.x (최신 안정 버전)
   템플릿: 프리 티어 (또는 개발/테스트)
   ```

4. **설정:**
   ```
   DB 인스턴스 식별자: tdb-database
   마스터 사용자 이름: admin
   마스터 암호: [강력한 비밀번호 입력]
   암호 확인: [재입력]
   ```

5. **DB 인스턴스 크기:**
   ```
   DB 인스턴스 클래스: db.t3.micro (프리 티어)
   스토리지 유형: 범용 SSD (gp2)
   할당된 스토리지: 20 GB
   ```

6. **연결:**
   ```
   컴퓨팅 리소스: 기존 EC2 인스턴스에 연결 안 함
   VPC: 기본 VPC (또는 EC2와 동일한 VPC)
   퍼블릭 액세스: 예 (개발 단계, 나중에 변경 가능)
   VPC 보안 그룹: 새로 생성
     이름: tdb-rds-sg
   가용 영역: 기본 설정
   ```

7. **추가 구성:**
   ```
   초기 데이터베이스 이름: tdb
   DB 파라미터 그룹: 기본값
   백업: 자동 백업 활성화 (권장)
   암호화: 활성화 (권장)
   ```

8. **생성 후:**
   - 생성 완료까지 5-10분 소요
   - **엔드포인트 주소 복사**: `tdb-database.xxxxx.ap-northeast-2.rds.amazonaws.com`
   - **포트**: 3306

---

## 3. 보안 그룹 설정

### A. RDS 보안 그룹 설정 (tdb-rds-sg)

1. **EC2 콘솔 → 보안 그룹** 이동
2. **`tdb-rds-sg` 선택**
3. **인바운드 규칙 편집:**

   | 유형 | 프로토콜 | 포트 | 소스 | 설명 |
   |------|----------|------|------|------|
   | MySQL/Aurora | TCP | 3306 | EC2 보안 그룹 ID (sg-xxxxx) | EC2에서 접근 |
   | MySQL/Aurora | TCP | 3306 | 내 IP | 로컬에서 접근 (선택) |

### B. EC2 보안 그룹 확인

1. **EC2 인스턴스의 보안 그룹 선택**
2. **아웃바운드 규칙 확인:**
   - ✅ 모든 트래픽 (0.0.0.0/0) 허용되어 있어야 함

---

## 4. EC2에서 RDS 연결

### 방법 1: 자동 설정 스크립트 사용 (권장)

```bash
# 1. EC2에 SSH 접속
ssh -i your-key.pem ec2-user@ec2-3-37-87-255.ap-northeast-2.compute.amazonaws.com

# 2. 프로젝트 디렉토리로 이동
cd /path/to/TDB_Project/integrated-server

# 3. 스크립트 실행 권한 부여
chmod +x setup-rds.sh

# 4. 스크립트 실행
./setup-rds.sh

# 5. 프롬프트에 따라 입력:
#    - RDS 엔드포인트
#    - 마스터 사용자 이름
#    - 마스터 암호
```

### 방법 2: 수동 설정

```bash
# 1. 연결 테스트
mysql -h tdb-database.xxxxx.ap-northeast-2.rds.amazonaws.com \
      -P 3306 \
      -u admin \
      -p

# 2. 데이터베이스 확인
mysql> SHOW DATABASES;
mysql> USE tdb;

# 3. 테이블 생성 (DATABASE_MIGRATIONS.sql 실행)
mysql -h tdb-database.xxxxx.ap-northeast-2.rds.amazonaws.com \
      -P 3306 \
      -u admin \
      -p tdb < ../DATABASE_MIGRATIONS.sql

# 4. .env 파일 생성
cat > .env << EOF
NODE_ENV=production
PORT=3000

DB_HOST=tdb-database.xxxxx.ap-northeast-2.rds.amazonaws.com
DB_PORT=3306
DB_USERNAME=admin
DB_PASSWORD=your-password-here
DB_DATABASE=tdb

JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=10h
JWT_REFRESH_EXPIRES_IN=7d

LOG_LEVEL=info
EOF
```

---

## 5. 애플리케이션 배포

### A. PM2 설치 (없는 경우)

```bash
npm install -g pm2
```

### B. 프로젝트 빌드 및 배포

```bash
# 1. 의존성 설치
npm install

# 2. 빌드
npm run build

# 3. 배포 스크립트 실행
chmod +x deploy-ec2.sh
./deploy-ec2.sh
```

### C. 서버 상태 확인

```bash
# PM2 상태 확인
pm2 status

# 로그 확인
pm2 logs tdb-integrated-server

# 또는 직접 로그 파일 확인
tail -f logs/out.log
tail -f logs/error.log
```

### D. API 테스트

```bash
# 헬스체크
curl http://localhost:3000/api/health/status

# 로그인 테스트 (사용자 생성 후)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

---

## 6. 문제 해결

### ❌ 연결 실패: "Can't connect to MySQL server"

**원인:**
- RDS 보안 그룹에서 EC2 IP/보안 그룹이 허용되지 않음

**해결:**
1. RDS 보안 그룹 인바운드 규칙 확인
2. EC2의 퍼블릭 IP 또는 보안 그룹 ID를 소스로 추가
3. RDS 인스턴스 상태가 "사용 가능"인지 확인

### ❌ 인증 실패: "Access denied for user"

**원인:**
- 사용자 이름 또는 암호 오류

**해결:**
1. RDS 콘솔에서 마스터 사용자 이름 확인
2. 암호를 올바르게 입력했는지 확인
3. 필요 시 RDS 콘솔에서 마스터 암호 재설정

### ❌ 데이터베이스 없음: "Unknown database 'tdb'"

**원인:**
- RDS 생성 시 초기 데이터베이스 이름을 지정하지 않음

**해결:**
```bash
# MySQL 접속 후 수동 생성
mysql -h your-rds-endpoint -u admin -p

mysql> CREATE DATABASE tdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
mysql> USE tdb;
mysql> source /path/to/DATABASE_MIGRATIONS.sql;
```

### ❌ TypeORM 연결 오류

**원인:**
- .env 파일 설정 오류

**해결:**
```bash
# .env 파일 확인
cat .env

# 환경 변수 로드 확인
node -e "require('dotenv').config(); console.log(process.env.DB_HOST);"

# 서버 재시작
pm2 restart tdb-integrated-server
```

### 🔍 디버깅 팁

```bash
# 1. RDS 엔드포인트 ping 테스트 (안 될 수 있음, ICMP 차단된 경우)
ping tdb-database.xxxxx.ap-northeast-2.rds.amazonaws.com

# 2. 포트 연결 테스트
telnet tdb-database.xxxxx.ap-northeast-2.rds.amazonaws.com 3306

# 3. MySQL 연결 로그 확인
mysql -h your-rds-endpoint -u admin -p -v

# 4. 애플리케이션 로그 실시간 확인
pm2 logs tdb-integrated-server --lines 100
```

---

## 📊 배포 후 체크리스트

- [ ] RDS 인스턴스 "사용 가능" 상태
- [ ] EC2에서 RDS로 MySQL 연결 성공
- [ ] 데이터베이스 `tdb` 생성 및 테이블 마이그레이션 완료
- [ ] `.env` 파일 생성 및 환경 변수 설정
- [ ] 애플리케이션 빌드 성공 (`npm run build`)
- [ ] PM2로 서버 실행 중
- [ ] 헬스체크 API 응답 정상 (`/api/health/status`)
- [ ] 인증 API 테스트 성공 (`/api/auth/login`)
- [ ] 프론트엔드 앱에서 서버 연결 확인

---

## 🔐 보안 권장사항

### 프로덕션 환경:

1. **RDS 퍼블릭 액세스 비활성화**
   - VPC 내부에서만 접근 가능하도록 설정

2. **강력한 암호 사용**
   - 대소문자, 숫자, 특수문자 포함
   - 최소 16자 이상

3. **JWT_SECRET 강화**
   ```bash
   openssl rand -base64 64
   ```

4. **정기 백업 활성화**
   - RDS 자동 백업 설정
   - 백업 보관 기간: 7일 이상

5. **SSL/TLS 연결 활성화**
   - TypeORM 설정에 SSL 옵션 추가

6. **EC2 보안 그룹 최소화**
   - 필요한 포트만 열기 (3000, 22)
   - SSH는 특정 IP만 허용

---

## 📞 도움말

문제가 계속되면:
1. RDS 콘솔에서 "연결 & 보안" 탭 확인
2. CloudWatch 로그 확인
3. AWS Support 문의

**참고 자료:**
- [AWS RDS MySQL 시작하기](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.CreatingConnecting.MySQL.html)
- [NestJS TypeORM 설정](https://docs.nestjs.com/techniques/database)
- [PM2 프로세스 관리](https://pm2.keymetrics.io/docs/usage/quick-start/)

