# 🤖 **라즈베리파이 개발자를 위한 API 변경사항 명세서**

## 📋 **개요**

이 문서는 **통합 서버**로 변경하면서 라즈베리파이 Python 코드에서 수정이 필요한 사항들을 상세히 기술합니다.

## 🌐 **서버 URL 변경**

### **기존 (변경 전)**
```python
# TDB-main/config.py
BASE_API_URL = 'http://192.168.59.208:3000/dispenser'
```

### **새로운 설정 (변경 후)**
```python
# config.py 수정 필요
BASE_API_URL = 'http://YOUR_SERVER_IP:3000'  # 통합 서버 주소로 변경
```

**⚠️ 주의사항**: 
- 통합 서버의 실제 IP 주소로 변경 필요
- `/dispenser` 경로는 자동으로 추가되므로 BASE_URL에는 포함하지 않음

---

## 🔄 **API 엔드포인트 변경사항**

### **✅ 변경 없음 - 그대로 사용 가능**

다음 API들은 **기존 라즈베리파이 코드와 100% 호환**됩니다:

| 기능 | 엔드포인트 | 메서드 | 상태 |
|-----|-----------|-------|------|
| UID 인증 | `/dispenser/verify-uid` | POST | ✅ 호환 |
| 배출 목록 조회 | `/dispenser/dispense-list` | POST | ✅ 호환 |
| 배출 결과 전송 | `/dispenser/dispense-result` | POST | ✅ 호환 |
| 복용 완료 처리 | `/dispenser/confirm` | POST | ✅ 호환 |

### **🔄 새로 추가된 API (선택적 사용)**

라즈베리파이에서 필요시 사용할 수 있는 추가 API들:

| 기능 | 엔드포인트 | 메서드 | 설명 |
|-----|-----------|-------|------|
| 기기 상태 조회 | `/dispenser/machine-status/:muid` | GET | 기기 정보 및 상태 |
| 연결된 사용자 조회 | `/dispenser/users/by-muid/:muid` | GET | 기기에 연결된 사용자 목록 |
| 오늘 스케줄 조회 | `/dispenser/schedules/today/:muid` | GET | 기기별 오늘의 모든 스케줄 |
| 슬롯 상태 조회 | `/dispenser/slots/status/:muid` | GET | 약품 잔량 및 슬롯 정보 |

---

## 📊 **데이터 구조 변경사항**

### **1. UID 인증 응답 (`verify-uid`)**

#### **✅ 기존 구조 유지됨**
```python
# 성공 응답 (기존과 동일)
{
    "status": "ok",
    "user": {
        "user_id": "U123",
        "name": "홍길동",
        "role": "user",
        "connect": "FAM001",
        "took_today": 0  # 🔹 중복 배출 방지용 (중요!)
    }
}

# 미등록 사용자 (기존과 동일)
{
    "status": "unregistered", 
    "qr_data": {
        "type": "register",
        "k_uid": "K001",
        "createdAt": "2025-01-29T12:00:00Z"
    }
}
```

### **2. 배출 목록 응답 (`dispense-list`)**

#### **✅ 기존 구조 + 슬롯 정보 추가**
```python
# 기존 구조 유지 + slot 정보 추가
[
    {
        "medi_id": "M001",
        "dose": 2,
        "medicine_name": "타이레놀",
        "slot": 1,                    # 🔹 새로 추가된 필드
        "time_of_day": "morning",
        "user_id": "U123"
    }
]
```

**📝 라즈베리파이 코드 수정 필요사항**:
```python
# utils/server_request.py의 execute_medicine_dispense() 함수 수정
for item in dispense_list:
    # 기존 코드
    medi_id = item.get('medi_id')
    dose = item.get('dose', 1)
    medicine_name = item.get('medicine_name', medi_id)
    
    # 🔹 새로 추가: 서버에서 슬롯 정보 우선 사용
    if 'slot' in item and item['slot']:
        slot_num = item['slot']
        print(f"[DISPENSE] 서버 슬롯 정보 사용: {medicine_name} -> 슬롯 {slot_num}")
    else:
        # 기존 매핑 테이블 사용 (백업)
        slot_num = slot_mapping.get(medi_id)
        print(f"[DISPENSE] 매핑 테이블 사용: {medicine_name} -> 슬롯 {slot_num}")
```

### **3. 복용 완료 응답 (`confirm`)**

#### **✅ 기존 구조 유지됨**
```python
# 성공 응답
{
    "status": "confirmed",
    "user_id": "U123", 
    "message": "복용이 확인되었습니다."
}

# 이미 완료된 경우
{
    "status": "already_confirmed",
    "message": "이미 오늘 복용이 확인되었습니다."
}
```

---

## 🔧 **라즈베리파이 코드 수정 가이드**

### **1. config.py 수정**

```python
# config.py 파일 수정
import os

# 서버 URL 설정 (통합 서버로 변경)
BASE_API_URL = os.getenv('DISPENSER_API_URL', 'http://YOUR_INTEGRATED_SERVER_IP:3000')

# 나머지 설정은 기존과 동일
SIMULATION_MODE = os.getenv('SIMULATION_MODE', 'True').lower() == 'true'
SERIAL_PORT = os.getenv('SERIAL_PORT', '/dev/ttyACM0')
BAUD_RATE = int(os.getenv('BAUD_RATE', '9600'))
```

### **2. utils/server_request.py 수정 (선택사항)**

기존 코드는 그대로 동작하지만, 성능 개선을 위해 다음 사항을 고려할 수 있습니다:

```python
def get_user_slot_mapping(device_id):
    """슬롯 매핑 정보 조회 (개선된 버전)"""
    print(f"[MAPPING] 슬롯 매핑 조회: {device_id}")
    
    client = get_client()
    
    # 🔹 새로운 API 사용 (선택사항)
    endpoints_to_try = [
        f"slots/status/{device_id}",    # 새로운 슬롯 상태 API
        f"machine-status/{device_id}",  # 기기 상태 API
        # 기존 엔드포인트들...
    ]
    
    # 나머지 로직은 기존과 동일
```

### **3. 중복 배출 방지 로직 강화 (권장)**

```python
def process_rfid_scan(self, uid):
    """RFID 스캔 처리 - 향상된 중복 방지"""
    
    # 1단계: 사용자 인증
    auth_result = verify_rfid_uid(uid)
    
    if not auth_result or auth_result.get('status') != 'ok':
        return False
    
    user = auth_result.get('user', {})
    took_today = user.get('took_today', 0)
    
    # 🔹 중복 배출 방지 강화
    if took_today == 1:
        print(f"[CHECK] ⚠️ {user.get('name')}님은 이미 오늘 약을 받으셨습니다")
        print("[CHECK] 🚫 중복 배출을 방지합니다")
        
        # 사용자에게 알림
        self._show_already_taken_message(user.get('name'))
        
        # ✅ 중요: 여기서 바로 리턴하여 배출 로직을 실행하지 않음
        return True  # 성공으로 처리하되 배출은 하지 않음
    
    # 배출 로직 계속 진행...
```

---

## 🚀 **새로운 기능 활용 가이드 (선택사항)**

### **1. 실시간 기기 상태 모니터링**

```python
def get_machine_status(device_id):
    """기기 상태 실시간 조회"""
    client = get_client()
    result = client.get(f"machine-status/{device_id}")
    
    if result:
        print(f"[STATUS] 기기 상태: {result.get('status')}")
        print(f"[STATUS] 연결된 사용자: {len(result.get('users', []))}명")
        print(f"[STATUS] 활성 슬롯: {len(result.get('slots', []))}개")
        return result
    
    return None
```

### **2. 슬롯별 잔량 모니터링**

```python
def check_medicine_levels(device_id):
    """약품 잔량 체크"""
    client = get_client()
    result = client.get(f"slots/status/{device_id}")
    
    if result and 'slots' in result:
        low_medicines = []
        for slot in result['slots']:
            if slot.get('remain', 0) < 10:  # 10개 미만일 때 경고
                low_medicines.append(slot)
        
        if low_medicines:
            print(f"[WARNING] 약품 부족 알림: {len(low_medicines)}개 슬롯")
            for med in low_medicines:
                print(f"  - 슬롯 {med.get('slot')}: {med.get('name')} ({med.get('remain')}개)")
        
        return low_medicines
    
    return []
```

---

## ⚠️ **중요 주의사항**

### **1. 기존 코드 호환성**
- 기존 라즈베리파이 코드는 **수정 없이도 동작**합니다
- 이 문서의 수정사항들은 **성능 개선 및 기능 확장**을 위한 권장사항입니다

### **2. 환경 변수 설정**
```bash
# 라즈베리파이 환경변수 설정
export DISPENSER_API_URL="http://YOUR_INTEGRATED_SERVER_IP:3000"
export SIMULATION_MODE="False"  # 실제 하드웨어에서는 False
```

### **3. 네트워크 연결 확인**
```python
# 서버 연결 테스트 함수 추가 권장
def test_integrated_server_connection():
    """통합 서버 연결 테스트"""
    try:
        client = get_client()
        result = client.get("")  # 루트 경로 테스트
        print("[TEST] ✅ 통합 서버 연결 성공")
        return True
    except Exception as e:
        print(f"[TEST] ❌ 통합 서버 연결 실패: {e}")
        return False
```

### **4. 로깅 개선**
```python
# 통합 서버용 로깅 추가
def log_api_call(endpoint, response_time, success):
    """API 호출 로그"""
    status = "✅" if success else "❌"
    print(f"[API] {status} {endpoint} ({response_time:.2f}ms)")
```

---

## 📞 **지원 및 문의**

- **통합 서버 관련 문의**: 앱 개발팀
- **라즈베리파이 코드 수정 문의**: 하드웨어 개발팀
- **API 문서**: `integrated-server/README.md` 참조

---

## 📈 **마이그레이션 체크리스트**

### **필수 사항** ✅
- [ ] `config.py`에서 `BASE_API_URL` 변경
- [ ] 통합 서버와 연결 테스트
- [ ] 기존 API 동작 확인

### **권장 사항** 🔹
- [ ] 슬롯 정보 활용 로직 추가
- [ ] 실시간 상태 모니터링 구현  
- [ ] 약품 잔량 알림 기능 추가
- [ ] 로깅 및 에러 처리 개선

### **검증 사항** 🧪
- [ ] RFID 인증 정상 동작
- [ ] 약 배출 정상 동작
- [ ] 중복 배출 방지 정상 동작
- [ ] 복용 완료 처리 정상 동작 