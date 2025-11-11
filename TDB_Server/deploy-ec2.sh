#!/bin/bash

# EC2 배포 스크립트
echo "🚀 TDB Integrated Server EC2 배포 시작"

# 1. 빌드
echo "📦 프로젝트 빌드 중..."
npm run build

# 2. logs 디렉토리 생성
mkdir -p logs

# 3. PM2 없으면 nohup으로 백그라운드 실행
echo "🔄 서버 배포 중..."
if command -v pm2 >/dev/null 2>&1; then
    echo "PM2로 서버 시작/재시작..."
    if pm2 describe tdb-integrated-server > /dev/null 2>&1; then
        echo "기존 서버 재시작 중..."
        pm2 restart ecosystem.config.js --env production
    else
        echo "새 서버 시작 중..."
        pm2 start ecosystem.config.js --env production
    fi
    pm2 status
else
    echo "PM2를 찾을 수 없어 nohup으로 실행합니다..."
    # 기존 프로세스 종료
    pkill -f "node.*dist/main.js" || echo "실행 중인 서버가 없습니다"
    
    # 백그라운드에서 서버 시작
    NODE_ENV=production PORT=3000 nohup node dist/main.js > server.log 2>&1 &
    
    echo "서버가 백그라운드에서 시작되었습니다"
    echo "로그 확인: tail -f server.log"
fi

echo "✅ 배포 완료!"
echo "🌐 서버 주소: http://ec2-3-37-87-255.ap-northeast-2.compute.amazonaws.com:3000"
echo "📊 API 문서: http://ec2-3-37-87-255.ap-northeast-2.compute.amazonaws.com:3000/api"
echo "🔍 서버 상태 확인: curl http://localhost:3000/api/health/status"
echo "🔍 인증 테스트: curl http://localhost:3000/api/auth/login -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}'" 