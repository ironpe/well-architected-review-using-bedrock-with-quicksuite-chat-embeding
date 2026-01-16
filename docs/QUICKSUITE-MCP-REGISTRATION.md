# QuickSuite MCP Action 등록 가이드

## 📋 개요

이 문서는 AgentCore Gateway에 연결된 MCP Lambda를 QuickSuite Chat Agent에서 사용할 수 있도록 MCP Action으로 등록하는 방법을 설명합니다.

## 🔧 사전 요구사항

다음 스크립트가 모두 실행되어 있어야 합니다:

```bash
# 1. 백엔드 빌드 및 CDK 배포
cd backend && npm run build && ./package-mcp.sh
cd ../infrastructure && npx cdk deploy

# 2. Cognito 설정 (프로젝트 루트에서 실행)
cd ..
./scripts/setup-agentcore-cognito.sh

# 3. AgentCore Gateway 설정 (AWS CLI bedrock-agentcore-control 사용)
./scripts/setup-agentcore-gateway.sh
```

설정 정보 확인:
```bash
cat infrastructure/.env.agentcore
```

---

## 📝 설정 정보 예시

### 생성된 리소스

| 항목 | 값 |
|------|-----|
| Gateway Name | `your-gateway-name` |
| Gateway ID | `your-gateway-id` |
| Gateway URL | `https://your-gateway-id.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp` |
| Target Name | `your-target-name` |
| Target ID | `YOUR_TARGET_ID` |

### 인증 정보

| 항목 | 값 |
|------|-----|
| Client ID | `your-client-id` |
| Client Secret | `your-client-secret` |
| Token URL | `https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/token` |

> ⚠️ 실제 값은 `infrastructure/.env.agentcore` 파일에서 확인하세요.

---

## 🚀 등록 절차

### Step 1: QuickSuite 콘솔 접속

1. AWS 콘솔에서 **Amazon QuickSight** 서비스로 이동
2. 좌측 메뉴에서 **Integrations** 클릭

### Step 2: MCP Action 추가

1. **Actions** 탭 선택
2. **Model Context Protocol** 섹션 찾기
3. **+** 버튼 클릭

### Step 3: 기본 정보 입력

| 필드 | 값 |
|------|-----|
| Name | `Architecture Review Data MCP` |
| Description | `DynamoDB에서 아키텍처 리뷰 데이터를 조회하는 MCP 도구 모음. 리뷰 요청, 문서, 실행 결과, Pillar 설정, 거버넌스 정책을 조회할 수 있습니다.` |

### Step 4: URL 설정

| 필드 | 값 |
|------|-----|
| MCP server endpoint | `https://<GATEWAY_ID>.gateway.bedrock-agentcore.<REGION>.amazonaws.com/mcp` |

### Step 5: 인증 설정

1. **Authentication method** 선택: `Service authentication`
2. **Authentification type** 선택: `Service-to-service OAuth` |

2. 다음 값들을 입력 (`infrastructure/.env.agentcore`에서 확인):

| 필드 | 환경변수 |
|------|-----|
| Client ID | `AGENTCORE_CLIENT_ID` |
| Client Secret | `AGENTCORE_CLIENT_SECRET` |
| Token URL | `COGNITO_TOKEN_URL` |

### Step 6: 저장 및 확인

1. **Create and continue** 버튼 클릭
2. MCP Action이 목록에 추가되었는지 확인
3. Status가 **Available**인지 확인

---

## ✅ 등록 확인

### 사용 가능한 도구 목록

등록이 완료되면 QuickSuite Chat Agent에서 다음 8개 도구를 사용할 수 있습니다:

| 도구명 | 설명 |
|--------|------|
| `list_review_requests` | 리뷰 요청 목록 조회 |
| `get_review_request` | 특정 리뷰 요청 상세 조회 |
| `list_documents` | 문서 목록 조회 |
| `get_document` | 특정 문서 상세 조회 |
| `list_review_executions` | 리뷰 실행 기록 조회 |
| `get_review_execution` | 특정 리뷰 실행 결과 조회 |
| `list_pillar_configs` | Pillar 설정 조회 |
| `list_governance_policies` | 거버넌스 정책 조회 |

### 테스트 방법

QuickSuite Chat Agent에서 다음과 같이 테스트:

```
"아키텍처 리뷰 요청 목록을 보여줘"

"최근 완료된 리뷰 실행 결과를 조회해줘"

"Pillar 설정 목록을 확인해줘"

"리뷰 요청 ID xxx의 상세 정보를 알려줘"
```

---

## 🔧 문제 해결

### 인증 오류 (401 Unauthorized)

1. Client ID/Secret이 올바른지 확인
2. Token URL이 정확한지 확인

```bash
# 토큰 발급 테스트
curl -X POST "$COGNITO_TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$AGENTCORE_CLIENT_ID" \
  -d "client_secret=$AGENTCORE_CLIENT_SECRET"
```

### 연결 오류 (Connection Failed)

1. Gateway URL이 올바른지 확인
2. Gateway 상태가 READY인지 확인

```bash
# Gateway 상태 확인
aws bedrock-agentcore-control get-gateway \
  --gateway-identifier $GATEWAY_ID \
  --region us-east-1
```

### 도구가 표시되지 않음

1. Lambda Target이 등록되었는지 확인
2. Tool Schema가 올바른지 확인

```bash
# Target 목록 확인
aws bedrock-agentcore-control list-gateway-targets \
  --gateway-identifier $GATEWAY_ID \
  --region us-east-1
```

### Lambda 실행 오류

1. CloudWatch Logs에서 Lambda 로그 확인
2. DynamoDB 테이블 권한 확인

```bash
# Lambda 함수명은 CDK 배포 후 확인
aws logs tail /aws/lambda/<MCP_LAMBDA_FUNCTION_NAME> --follow
```

---

## 📊 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                     QuickSuite Q Chat                           │
│                                                                 │
│  "아키텍처 리뷰 요청 목록을 보여줘"                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MCP Action (등록됨)                            │
│                                                                 │
│  Name: Architecture Review Data MCP                             │
│  Auth: Service authentication (2LO)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ OAuth2 Token
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Cognito User Pool                              │
│                                                                 │
│  Token URL: https://<cognito-domain>.auth.<region>...           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ JWT Token
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                AgentCore Gateway (MCP)                          │
│                                                                 │
│  ID: <gateway-id>                                               │
│  Target: <target-name> (<target-id>)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ tools/call
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MCP Lambda Function                           │
│                                                                 │
│  ARN: arn:aws:lambda:<region>:<account>:function:...            │
│  Tools: 8개                                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DynamoDB Tables                              │
│                                                                 │
│  - ReviewRequests                                               │
│  - Documents                                                    │
│  - ReviewExecutions                                             │
│  - PillarConfigurations                                         │
│  - GovernancePolicies                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 관련 파일

| 파일 | 설명 |
|------|------|
| `backend/src/mcp-server/lambda.ts` | MCP Lambda 핸들러 |
| `backend/src/mcp-server/tools.ts` | MCP 도구 정의 |
| `infrastructure/lib/minimal-stack.ts` | CDK 스택 |
| `infrastructure/.env.agentcore` | 설정 정보 (배포 후 생성) |
| `scripts/setup-agentcore-cognito.sh` | Cognito 설정 스크립트 |
| `scripts/setup-agentcore-gateway.sh` | Gateway 설정 스크립트 (AWS CLI 사용) |

---

**작성일**: 2026-01-14
