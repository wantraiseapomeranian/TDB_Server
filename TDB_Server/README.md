# 🏥 **TDB 통합 서버 (Integrated Server)**

## 📋 **개요**

이 프로젝트는 **React Native 앱**과 **라즈베리파이 하드웨어**를 모두 지원하는 통합 서버입니다.
- 앱 서버의 엔티티별 구조 유지
- 라즈베리파이 서버의 디스펜서 로직 통합
- API 엔드포인트 표준화 및 호환성 보장

## 🏗️ **프로젝트 구조**

```
integrated-server/
├── src/
│   ├── auth/              # 인증 관련
│   ├── users/             # 사용자 관리
│   ├── machine/           # 기기 관리 (라즈베리파이 API 포함)
│   ├── medicine/          # 약품 관리
│   ├── schedule/          # 복용 스케줄
│   ├── family/            # 가족 관리
│   ├── supplement/        # 영양제 관리
│   ├── dose-history/      # 복용 기록
│   ├── dispenser/         # 🔹 라즈베리파이 전용 API
│   └── shared/            # 공통 유틸리티
├── package.json
├── tsconfig.json
├── .env.example
└── API_CHANGES.md         # 🔹 라즈베리파이 개발자용 변경사항 명세
```

## 🔧 **주요 기능**

### **앱 클라이언트 지원**
- JWT 기반 인증
- 엔티티별 CRUD API
- 가족 단위 관리
- 복용 기록 및 통계

### **라즈베리파이 클라이언트 지원**
- RFID UID 기반 인증
- 약 배출 로직
- 하드웨어 상태 모니터링
- 실시간 스케줄 조회

## 🚀 **실행 방법**

```bash
# 패키지 설치
npm install

# 환경변수 설정
cp .env.example .env

# 개발 서버 실행
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod
```

## 🌐 **API 엔드포인트**

### **앱용 API** (JWT 인증 필요)
- `/auth/*` - 인증
- `/users/*` - 사용자 관리
- `/machine/*` - 기기 관리
- `/medicine/*` - 약품 관리
- `/schedule/*` - 스케줄 관리
- `/family/*` - 가족 관리

### **라즈베리파이용 API** (인증 없음)
- `/dispenser/verify-uid` - UID 인증
- `/dispenser/dispense-list` - 배출 목록
- `/dispenser/dispense-result` - 배출 결과
- `/dispenser/confirm` - 복용 확인

## ⚠️ **중요 사항**

1. **포트**: 3000 (기본값)
2. **데이터베이스**: MySQL
3. **인증 방식**: 
   - 앱: JWT Bearer Token
   - 라즈베리파이: 인증 없음 (IP 기반 보안 권장)

## 📝 **라즈베리파이 개발자 참고사항**

라즈베리파이 Python 코드 수정이 필요한 사항은 `API_CHANGES.md` 파일을 참조하세요. 