# 성능 최적화 가이드

## 목차
1. [현재 최적화 상태](#현재-최적화-상태)
2. [환경 변수 설정](#환경-변수-설정)
3. [성능 분석](#성능-분석)
4. [모델별 최적화](#모델별-최적화)
5. [롤백 방법](#롤백-방법)

---

## 현재 최적화 상태

### ✅ 적용된 최적화

**1. 이중 Vision 분석 제거**
- Nova 선택 시 추가 Claude 분석 제거
- 절감: 84초 (73%), $0.036 (20%)

**2. Pillar 분석에서 이미지 제거**
- Pillar는 텍스트만으로 분석
- 절감: 20초 (19%), $0.450 (Claude 시 69%)

**3. Executive Summary 동기 생성**
- 아키텍처 다이어그램 + 영역별 분석 통합
- 소요: 15초, $0.027

### 📊 최종 성능

| 모델 | 실행 시간 | 비용 | 개선 |
|------|-----------|------|------|
| **Nova Lite** | 77초 | $0.144 | 52% 단축, 20% 절감 |
| **Nova Pro** | 80초 | $0.160 | 50% 단축, 20% 절감 |
| **Claude Opus** | 101초 | $0.228 | 5% 단축, 65% 절감 |
| **Mistral** | 85초 | $0.170 | 47% 단축, 32% 절감 |

---

## 환경 변수 설정

### Lambda 환경 변수

```typescript
// infrastructure/lib/minimal-stack.ts

const lambdaEnv = {
  // ... 기존 환경 변수 ...
  
  // 성능 최적화 플래그
  INCLUDE_PILLAR_IMAGES: 'false',              // Pillar 분석에 이미지 제외
  GENERATE_EXECUTIVE_SUMMARY_SYNC: 'true',    // Executive Summary 생성
};
```

### 설정 옵션

| 변수 | 값 | 설명 | 효과 |
|------|-----|------|------|
| `INCLUDE_PILLAR_IMAGES` | `false` | Pillar 분석 시 이미지 제외 | -20초, -$0.450 (Claude) |
| `INCLUDE_PILLAR_IMAGES` | `true` | Pillar 분석 시 이미지 포함 | 품질 향상 가능 |
| `GENERATE_EXECUTIVE_SUMMARY_SYNC` | `true` | Executive Summary 생성 | +15초, +$0.027 |
| `GENERATE_EXECUTIVE_SUMMARY_SYNC` | `false` | Executive Summary 생략 | 빠른 결과 확인 |

---

## 성능 분석

### 실행 시간 분석 (1페이지 문서)

#### Nova 선택 시
```
1. PDF 다운로드                    (~2초)
2. Nova 전체 스캔                  (~15초)
3. Nova Vision 분석                (~30초)
4. 6개 Pillar 병렬 (텍스트)        (~20초)
5. Executive Summary               (~15초)
6. 리포트 생성                     (~9초)
─────────────────────────────────────────
총: 77초 (원래 161초 대비 52% 단축)
```

#### Claude 선택 시
```
1. PDF 다운로드                    (~2초)
2. Nova 전체 스캔                  (~15초)
3. PDF → 이미지 변환               (~10초)
4. Claude Vision 분석              (~30초)
5. 6개 Pillar 병렬 (텍스트)        (~20초)
6. Executive Summary               (~15초)
7. 리포트 생성                     (~9초)
─────────────────────────────────────────
총: 101초 (원래 106초 대비 5% 단축)
```

### 비용 분석

#### Nova Lite 선택 시
| 항목 | 비용 |
|------|------|
| Nova 스캔 | $0.006 |
| Nova Vision | $0.003 |
| Pillar 분석 (텍스트) | $0.108 |
| Executive Summary | $0.027 |
| **총** | **$0.144** |

#### Claude Opus 선택 시
| 항목 | 비용 |
|------|------|
| Nova 스캔 | $0.006 |
| 이미지 변환 | $0.0001 |
| Claude Opus Vision | $0.090 |
| Pillar 분석 (텍스트) | $0.108 |
| Executive Summary | $0.027 |
| **총** | **$0.228** |

**비교**: Claude가 Nova보다 58% 비쌈

---

## 모델별 최적화

### Nova 선택 시 최적화

**장점**:
- ✅ PDF 직접 처리 (이미지 변환 불필요)
- ✅ 빠른 실행 (77초)
- ✅ 저렴한 비용 ($0.144)
- ✅ 한글 지원 우수

**권장 설정**:
- Max Tokens: 8192
- Temperature: 0.3
- DPI: 불필요 (PDF 직접 처리)

### Claude 선택 시 최적화

**장점**:
- ✅ 최고 품질 분석
- ✅ 복잡한 다이어그램 이해
- ✅ 상세한 권장사항

**단점**:
- ❌ 이미지 변환 필요 (+10초)
- ❌ 높은 비용 ($0.228)

**권장 설정**:
- Max Tokens: 4096
- Temperature: 0.7
- DPI: 150 (또는 100으로 최적화)

**추가 최적화**:
```typescript
// Pillar 분석 모델을 Sonnet으로 변경
// Vision: Opus ($0.090)
// Pillar: Sonnet ($0.018)
// 총 비용: $0.123 (46% 절감)
```

### Mistral 선택 시 최적화

**장점**:
- ✅ 대용량 컨텍스트 (128K)
- ✅ PDF 직접 처리
- ✅ 한글 지원

**권장 설정**:
- Max Tokens: 16384 (대용량 문서)
- Temperature: 0.5
- DPI: 불필요

---

## 롤백 방법

### 빠른 롤백 (30초)

**AWS Console**:
1. Lambda 콘솔 접속
2. `ArchReview-Minimal-ReviewExecutionFn...` 선택
3. Configuration → Environment variables
4. 변수 수정:
   - `INCLUDE_PILLAR_IMAGES`: `false` → `true`
   - `GENERATE_EXECUTIVE_SUMMARY_SYNC`: `true` → `false`
5. Save

**AWS CLI**:
```bash
# Lambda 함수 이름 확인
FUNCTION_NAME=$(aws lambda list-functions \
  --query "Functions[?contains(FunctionName, 'ReviewExecutionFn')].FunctionName" \
  --output text)

# 환경 변수 업데이트
aws lambda update-function-configuration \
  --function-name $FUNCTION_NAME \
  --environment "Variables={
    REVIEW_REQUESTS_TABLE=...,
    INCLUDE_PILLAR_IMAGES=true,
    GENERATE_EXECUTIVE_SUMMARY_SYNC=false
  }"
```

### CDK 재배포 (2분)

```typescript
// infrastructure/lib/minimal-stack.ts
const lambdaEnv = {
  // ...
  INCLUDE_PILLAR_IMAGES: 'true',             // 롤백
  GENERATE_EXECUTIVE_SUMMARY_SYNC: 'false',  // 롤백
};
```

```bash
cd infrastructure
cdk deploy --all
```

### 부분 롤백

**Pillar 이미지만 복원**:
```typescript
INCLUDE_PILLAR_IMAGES: 'true',              // 롤백
GENERATE_EXECUTIVE_SUMMARY_SYNC: 'true',   // 유지
```
- 효과: 품질 향상, +20초, +$0.450 (Claude)

**Executive Summary만 제거**:
```typescript
INCLUDE_PILLAR_IMAGES: 'false',            // 유지
GENERATE_EXECUTIVE_SUMMARY_SYNC: 'false',  // 롤백
```
- 효과: 빠른 결과, -15초, -$0.027

---

## 모니터링

### CloudWatch Logs 확인

```bash
# 실시간 로그 확인
aws logs tail /aws/lambda/[ReviewExecutionFn] --since 5m --follow

# 특정 실행 검색
aws logs filter-log-events \
  --log-group-name /aws/lambda/[ReviewExecutionFn] \
  --filter-pattern "[executionId]" \
  --start-time [timestamp]
```

### 주요 로그 메시지

**최적화 활성화 시**:
```
✅ "Analyzing page X with [selected-model]..."
✅ "[Pillar] Using text model"
✅ "Executive summary generation skipped" (비동기 모드)
❌ "Converting page X to image for additional Claude" (없음)
❌ "Generating comprehensive summary" (없음)
```

**롤백 시**:
```
✅ "Analyzing page X with [selected-model]..."
✅ "[Pillar] Using vision model with X images"
✅ "Generating executive summary synchronously"
✅ "Converting page X to image for additional Claude"
```

### 성능 메트릭

**DynamoDB에서 확인**:
```bash
aws dynamodb get-item \
  --table-name [ReviewExecutionsTable] \
  --key '{"PK":{"S":"EXEC#[executionId]"},"SK":{"S":"METADATA"}}' \
  --query 'Item.{start:startedAt.S, end:completedAt.S}'
```

**실행 시간 계산**:
```python
from datetime import datetime
start = datetime.fromisoformat(start_time)
end = datetime.fromisoformat(end_time)
duration = (end - start).total_seconds()
print(f"실행 시간: {duration}초")
```

---

## 추가 최적화 옵션

### 1. 이미지 DPI 조정

**현재**: DPI 150
**개선**: DPI 100

```python
# backend/pdf-converter/lambda_function.py
dpi = event.get('dpi', 100)  # 기본값 변경
```

**효과**: 2-3초 절감, 이미지 크기 56% 감소

### 2. 다중 페이지 병렬 처리

```typescript
// 여러 페이지 동시 변환 및 분석
const promises = pagesToAnalyze.map(async (pageNum) => {
  const imageBuffer = await convertToImage(pageNum);
  return await analyzeWithVision(imageBuffer, pageNum);
});
const analyses = await Promise.all(promises);
```

**효과**: 다중 페이지 시 큰 효과

### 3. 캐싱 전략

```typescript
// S3에 이미지 캐싱
const cacheKey = `cache/${documentId}/page-${pageNum}-dpi-${dpi}.png`;
// 재검토 시 캐시 사용
```

**효과**: 재검토 시 10초 절감

---

## 품질 vs 성능 트레이드오프

### 최적화 활성화 (현재)
- ⏱️ **실행 시간**: 빠름 (77-101초)
- 💰 **비용**: 저렴 ($0.144-$0.228)
- 🎯 **품질**: 우수 (선택한 모델만 사용)

### 롤백 (이전)
- ⏱️ **실행 시간**: 느림 (161초)
- 💰 **비용**: 비쌈 ($0.180-$0.651)
- 🎯 **품질**: 최고 (이중 분석)

### 권장 설정

**일반 문서**: 최적화 활성화
- 빠른 결과 확인
- 비용 효율적
- 충분한 품질

**복잡한 문서**: 부분 롤백 고려
- Pillar 이미지 포함 (`INCLUDE_PILLAR_IMAGES=true`)
- 품질 향상
- +20초, +$0.450 (Claude)

---

## 문제 해결

### 실행 시간이 너무 느림 (2분 이상)

**원인**: 최적화 비활성화

**해결**:
```bash
# 환경 변수 확인
aws lambda get-function-configuration \
  --function-name [ReviewExecutionFn] \
  --query 'Environment.Variables.{INCLUDE_PILLAR_IMAGES:INCLUDE_PILLAR_IMAGES}' \
  --output json

# false로 설정
aws lambda update-function-configuration \
  --function-name [ReviewExecutionFn] \
  --environment "Variables={..., INCLUDE_PILLAR_IMAGES=false}"
```

### Pillar 분석 품질 저하

**원인**: 이미지 제거로 시각적 분석 부족

**해결**:
```bash
# Pillar 이미지 포함으로 롤백
INCLUDE_PILLAR_IMAGES=true
```

### Executive Summary 없음

**원인**: 비동기 모드

**해결**:
```bash
# 동기 생성으로 변경
GENERATE_EXECUTIVE_SUMMARY_SYNC=true
```

---

## 참고 자료

### 상세 분석 문서
- 실행 시간 분석: 병목 구간 상세 분석
- 비용 분석: 모델별 비용 비교
- Claude 최적화: Claude 선택 시 추가 최적화

### 관련 코드
- `backend/src/config/environment.ts`: 환경 변수 정의
- `backend/src/services/AgentOrchestrationService.ts`: 최적화 로직
- `infrastructure/lib/minimal-stack.ts`: Lambda 환경 변수 설정

---

## 요약

**현재 최적화**:
- ✅ 이중 Vision 분석 제거
- ✅ Pillar 이미지 제거
- ✅ Executive Summary 생성

**성능**:
- Nova: 77초, $0.144 (52% 단축)
- Claude: 101초, $0.228 (65% 비용 절감)

**롤백**: 환경 변수로 즉시 가능 (30초)
