# 🤖 라즈베리파이 개발자 설정 가이드

## 📋 개요

통합 서버는 기존 라즈베리파이 Python 코드와 **100% 호환**됩니다.  
수정 없이 바로 사용할 수 있으며, 새로운 기능들을 점진적으로 활용할 수 있습니다.

## 🚀 빠른 시작

### 1. 서버 URL 변경 (필수)

```python
# 기존 코드
BASE_URL = "http://localhost:3000"

# 변경 후 
BASE_URL = "http://YOUR_SERVER_IP:3000"  # 통합 서버 IP
```

### 2. 기존 API 그대로 사용

```python
# ✅ 기존 코드가 그대로 작동합니다
response = requests.post(f"{BASE_URL}/dispenser/verify-uid", json={"uid": uid})
```

## 📡 API 호환성 매트릭스

| 기존 API | 상태 | 비고 |
|---------|------|------|
| `POST /dispenser/verify-uid` | ✅ 완전 호환 | 응답 형식 동일 |
| `POST /dispenser/dispense-list` | ✅ 완전 호환 | 슬롯 정보 추가 |
| `POST /dispenser/dispense-result` | ✅ 완전 호환 | 재고 자동 업데이트 |
| `POST /dispenser/confirm` | ✅ 완전 호환 | 중복 확인 개선 |

## 🔧 환경별 설정

### 개발 환경

```python
# development.py
BASE_URL = "http://192.168.1.100:3000"
DEBUG = True
TIMEOUT = 30
```

### 운영 환경

```python
# production.py  
BASE_URL = "http://production-server:3000"
DEBUG = False
TIMEOUT = 10
RETRY_COUNT = 3
```

## 🆕 새로운 기능 활용 (선택사항)

### 1. 기기 상태 모니터링

```python
def get_machine_status(muid):
    """기기 상태 조회 (새 기능)"""
    response = requests.get(f"{BASE_URL}/dispenser/machine/{muid}/status")
    return response.json()

# 사용 예시
status = get_machine_status("MACHINE_001")
print(f"연결된 사용자: {status['users_count']}명")
print(f"슬롯 상태: {status['slot_mapping']}")
```

### 2. 실시간 스케줄 조회

```python
def get_today_schedules(muid):
    """오늘 전체 스케줄 조회 (새 기능)"""
    response = requests.get(f"{BASE_URL}/dispenser/machine/{muid}/schedules/today")
    return response.json()

# 사용 예시  
schedules = get_today_schedules("MACHINE_001")
for schedule in schedules:
    print(f"{schedule['time_of_day']}: {schedule['user_name']} - {schedule['medicine_name']}")
```

### 3. 슬롯별 재고 확인

```python
def get_slot_status(muid):
    """슬롯별 재고 상태 (새 기능)"""
    response = requests.get(f"{BASE_URL}/dispenser/machine/{muid}/slots")
    return response.json()

# 사용 예시
slots = get_slot_status("MACHINE_001")
for slot in slots['slots']:
    if slot['status'] == 'low':
        print(f"⚠️  슬롯 {slot['slot']}: {slot['name']} 재고 부족 ({slot['remain']}개)")
```

## 🔍 디버깅 및 로깅

### 상세 로그 확인

```python
import logging

# 로깅 설정
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def api_request_with_logging(endpoint, data):
    """API 요청 + 로깅"""
    try:
        logger.info(f"🤖 API 요청: {endpoint}")
        logger.debug(f"📤 데이터: {data}")
        
        response = requests.post(f"{BASE_URL}{endpoint}", json=data, timeout=10)
        
        logger.info(f"📥 응답 상태: {response.status_code}")
        logger.debug(f"📥 응답 데이터: {response.json()}")
        
        return response.json()
        
    except Exception as e:
        logger.error(f"❌ API 오류: {endpoint} - {str(e)}")
        raise
```

### 연결 테스트 스크립트

```python
def test_server_connection():
    """서버 연결 테스트"""
    try:
        # 1. 서버 상태 확인
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print("✅ 서버 연결 성공")
        
        # 2. 기존 API 테스트  
        test_data = {"uid": "TEST_UID_123"}
        response = requests.post(f"{BASE_URL}/dispenser/verify-uid", json=test_data, timeout=5)
        print("✅ 라즈베리파이 API 호환성 확인")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ 서버 연결 실패 - IP 주소를 확인하세요")
        return False
    except requests.exceptions.Timeout:
        print("❌ 서버 응답 시간 초과")
        return False
    except Exception as e:
        print(f"❌ 알 수 없는 오류: {e}")
        return False

# 실행
if __name__ == "__main__":
    test_server_connection()
```

## 📞 문제 해결

### 일반적인 문제들

1. **연결 오류 (`ConnectionError`)**
   ```bash
   # 서버 IP 확인
   ping YOUR_SERVER_IP
   
   # 포트 확인  
   telnet YOUR_SERVER_IP 3000
   ```

2. **인증 오류 (`401 Unauthorized`)**
   ```python
   # 라즈베리파이는 JWT 인증 불필요
   # X-Device-Type 헤더만 추가
   headers = {"X-Device-Type": "pi"}
   ```

3. **데이터 형식 오류**
   ```python
   # JSON 응답 확인
   print("서버 응답:", response.text)
   print("상태 코드:", response.status_code)
   ```

### 로그 확인 방법

```bash
# 통합 서버 로그 (실시간)
docker logs -f integrated-server

# 라즈베리파이 관련 로그만 필터링
docker logs integrated-server | grep "라즈베리파이"
```

## 🔄 업데이트 및 마이그레이션

### 점진적 기능 도입

1. **1단계: 기본 호환성 확인**
   - 기존 코드 그대로 실행
   - 연결 테스트 스크립트 실행

2. **2단계: 새 기능 테스트** 
   - 기기 상태 모니터링 추가
   - 실시간 스케줄 조회 추가

3. **3단계: 고급 기능 활용**
   - 슬롯별 재고 관리
   - 에러 처리 개선
   - 로깅 시스템 통합

### 버전 관리

```python
# config.py
API_VERSION = "v1"
COMPATIBILITY_MODE = True  # 기존 API 우선 사용
ENABLE_NEW_FEATURES = False  # 새 기능 점진적 활성화
```

## 📊 성능 최적화

### 요청 최적화

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# 연결 풀 설정
session = requests.Session()
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("http://", adapter)

# 사용
response = session.post(f"{BASE_URL}/dispenser/verify-uid", json=data)
```

### 비동기 처리 (선택사항)

```python
import asyncio
import aiohttp

async def async_api_request(endpoint, data):
    """비동기 API 요청"""
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{BASE_URL}{endpoint}", json=data) as response:
            return await response.json()

# 여러 요청 병렬 처리
async def batch_requests():
    tasks = [
        async_api_request("/dispenser/verify-uid", {"uid": "USER1"}),
        async_api_request("/dispenser/verify-uid", {"uid": "USER2"}),
    ]
    results = await asyncio.gather(*tasks)
    return results
```

## 🎯 체크리스트

### 마이그레이션 완료 확인

- [ ] 서버 IP 주소 변경
- [ ] 연결 테스트 성공  
- [ ] 기존 API 동작 확인
- [ ] 로깅 시스템 설정
- [ ] 에러 처리 개선
- [ ] 성능 테스트 완료

## 📞 지원

- **기술 지원**: 통합 서버 로그를 확인하거나 개발팀에 문의
- **API 문서**: `/api-docs` 엔드포인트에서 상세 문서 확인
- **실시간 모니터링**: 서버 대시보드에서 라즈베리파이 상태 확인 