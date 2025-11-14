#!/bin/bash

# RDS 연결 설정 스크립트
echo "🗄️ RDS MySQL 연결 및 초기화"

# 환경 변수 로드
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
fi

# RDS 엔드포인트 입력 받기
echo "📝 RDS 엔드포인트를 입력하세요 (예: tdb-database.xxxxx.ap-northeast-2.rds.amazonaws.com):"
read RDS_ENDPOINT

echo "📝 RDS 마스터 사용자 이름을 입력하세요 (기본: admin):"
read RDS_USERNAME
RDS_USERNAME=${RDS_USERNAME:-admin}

echo "📝 RDS 마스터 암호를 입력하세요:"
read -s RDS_PASSWORD

echo ""
echo "🔍 연결 테스트 중..."

# MySQL 설치 확인
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL 클라이언트가 설치되어 있지 않습니다."
    echo "설치 방법:"
    echo "  Ubuntu/Debian: sudo apt-get install mysql-client"
    echo "  Amazon Linux 2: sudo yum install mysql"
    echo "  macOS: brew install mysql-client"
    exit 1
fi

# 연결 테스트
mysql -h "$RDS_ENDPOINT" -P 3306 -u "$RDS_USERNAME" -p"$RDS_PASSWORD" -e "SELECT VERSION();" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ RDS 연결 성공!"
    
    # DATABASE_MIGRATIONS.sql 실행
    if [ -f "../DATABASE_MIGRATIONS.sql" ]; then
        echo "📊 데이터베이스 마이그레이션 실행 중..."
        mysql -h "$RDS_ENDPOINT" -P 3306 -u "$RDS_USERNAME" -p"$RDS_PASSWORD" "tdb" < "../DATABASE_MIGRATIONS.sql"
        echo "✅ 마이그레이션 완료!"
    else
        echo "⚠️ DATABASE_MIGRATIONS.sql 파일을 찾을 수 없습니다."
    fi
    
    # .env 파일 생성
    echo ""
    echo "📝 .env 파일 생성 중..."
    cat > .env << EOF
# 환경 설정
NODE_ENV=production
PORT=3000

# 데이터베이스 설정 (RDS)
DB_HOST=$RDS_ENDPOINT
DB_PORT=3306
DB_USERNAME=$RDS_USERNAME
DB_PASSWORD=$RDS_PASSWORD
DB_DATABASE=tdb

# JWT 설정
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=10h
JWT_REFRESH_EXPIRES_IN=7d

# 로그 레벨
LOG_LEVEL=info
EOF
    
    echo "✅ .env 파일 생성 완료!"
    echo ""
    echo "🎉 RDS 설정이 완료되었습니다!"
    echo "📌 다음 단계: npm run build && npm run start:prod"
    
else
    echo "❌ RDS 연결 실패!"
    echo "다음 사항을 확인하세요:"
    echo "  1. RDS 엔드포인트 주소가 올바른지"
    echo "  2. 사용자 이름과 암호가 올바른지"
    echo "  3. RDS 보안 그룹에서 현재 IP/EC2가 허용되었는지"
    echo "  4. RDS 인스턴스가 '사용 가능' 상태인지"
fi

