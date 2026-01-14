# DynamoDB 조회용 MCP Lambda 구성 계획

## 📋 개요

현재 프로젝트(`infrastructure/lib/architecture-review-stack.ts`)의 5개 DynamoDB 테이블을 조회하는 MCP Lambda를 생성하고, AgentCore Gateway를 통해 QuickSuite Chat Agent에 연결합니다.

## 🏗️ 구성 아키텍처

```
QuickSuite Chat Agent
        ↓
AgentCore Gateway (MCP Protocol)
        ↓ (JWT 인증 - Cognito)
MCP Lambda Function
        ↓
DynamoDB Tables (5개)
```

## 📊 대상 DynamoDB 테이블

| 테이블 | 저장 데이터 |
|--------|-------------|
| ReviewRequests | 아키텍처 리뷰 요청 정보 |
| Documents | 업로드된 아키텍처 문서 메타데이터 |
| ReviewExecutions | 리뷰 실행 기록 및 결과 |
| PillarConfigurations | Well-Architected Pillar 설정 |
| GovernancePolicies | 거버넌스 정책 문서 정보 |

---

## 📝 단계별 계획

### 1단계: MCP Lambda 함수 개발 ✅ 완료

- **위치**: `backend/src/mcp-server/`
- **생성 파일**:
  - `lambda.ts` - MCP Lambda 핸들러
  - `tools.ts` - MCP 도구 정의
  - `index.ts` - 모듈 exports

#### 구현된 MCP 도구 (8개)

| 도구명 | 설명 | 대상 테이블 |
|--------|------|-------------|
| `list_review_requests` | 리뷰 요청 목록 조회 (상태 필터 지원) | ReviewRequests |
| `get_review_request` | 특정 리뷰 요청 상세 조회 | ReviewRequests |
| `list_documents` | 문서 목록 조회 | Documents |
| `get_document` | 특정 문서 상세 조회 | Documents |
| `list_review_executions` | 리뷰 실행 기록 목록 조회 | ReviewExecutions |
| `get_review_execution` | 특정 리뷰 실행 결과 조회 | ReviewExecutions |
| `list_pillar_configs` | Pillar 설정 목록 조회 | PillarConfigurations |
| `list_governance_policies` | 거버넌스 정책 목록 조회 | GovernancePolicies |

---

### 2단계: CDK 인프라 업데이트 ✅ 완료

- **위치**: `infrastructure/lib/architecture-review-stack.ts`
- **추가 항목**:
  - MCP Lambda 함수 정의 (`McpServerFunction`)
  - Lambda 환경 변수 (5개 테이블명, 버킷명)
  - API Gateway 엔드포인트:
    - `/mcp/v1/tools/list` (POST, Cognito 인증)
    - `/mcp/v1/tools/call` (POST, Cognito 인증)
    - `/mcp/health` (GET, 인증 없음)
  - CloudFormation Outputs:
    - `McpServerFunctionArn` - AgentCore Gateway 등록용
    - `McpServerFunctionName`
    - `McpApiEndpoint`

---

### 3단계: Cognito User Pool 설정 (AgentCore 인증용) ✅ 완료

- **방법**: AWS CLI 스크립트 (`scripts/setup-agentcore-cognito.sh`)
- **구성 요소**:

| 항목 | 설명 |
|------|------|
| User Pool Domain | OAuth 토큰 엔드포인트용 |
| Resource Server | OAuth Scopes 정의 (`read`, `write`) |
| M2M App Client | Client Credentials Flow용 |

#### 스크립트 실행 방법
```bash
./scripts/setup-agentcore-cognito.sh
```

#### 생성되는 정보 (infrastructure/.env.agentcore에 저장)
- User Pool ID / ARN
- Domain Name
- Client ID / Secret
- Token URL: `https://{domain}.auth.us-east-1.amazoncognito.com/oauth2/token`
- OAuth Scopes: `architecture-review-mcp/read`, `architecture-review-mcp/write`

---

### 4단계: AgentCore Gateway 설정 ✅ 완료

- **방법**: AWS CLI 스크립트 (`scripts/setup-agentcore-gateway.sh`)
- **구성 요소**:

| 항목 | 설명 |
|------|------|
| Gateway | MCP Protocol 타입, Semantic Search 활성화 |
| Lambda Target | MCP Lambda 함수 연결 |
| MCP Tools Schema | 8개 도구 스키마 등록 |

#### 스크립트 실행 방법
```bash
# 사전 요구사항: bedrock-agentcore-starter-toolkit 설치
pip install bedrock-agentcore-starter-toolkit

# Gateway 설정
./scripts/setup-agentcore-gateway.sh
```

#### 생성되는 정보 (infrastructure/.env.agentcore에 추가)
- Gateway Name / ARN / URL
- MCP Endpoint: `https://{gateway-id}.gateway.bedrock-agentcore.{region}.amazonaws.com/mcp`
- Target Name

---

### 5단계: QuickSuite MCP Action 등록 ✅ 완료

- **위치**: QuickSuite 콘솔 > Manage QuickSight > Integrations > Actions > Model Context Protocol
- **가이드 문서**: `docs/QUICKSUITE-MCP-REGISTRATION.md`

#### 등록 정보

```yaml
Name: Architecture Review Data MCP
Description: DynamoDB에서 아키텍처 리뷰 데이터를 조회하는 MCP 도구 모음
URL: https://{gateway-id}.gateway.bedrock-agentcore.{region}.amazonaws.com/mcp
Authentication:
  Type: Service authentication (2LO)
  Client ID: {AGENTCORE_CLIENT_ID}
  Client Secret: {AGENTCORE_CLIENT_SECRET}
  Token URL: https://{domain}.auth.{region}.amazoncognito.com/oauth2/token
  Scopes: ArchitectureReviewMcpGateway/invoke
```

#### 등록 후 표시될 도구 (8개)
- `architecture-review-mcp__list_review_requests`
- `architecture-review-mcp__get_review_request`
- `architecture-review-mcp__list_documents`
- `architecture-review-mcp__get_document`
- `architecture-review-mcp__list_review_executions`
- `architecture-review-mcp__get_review_execution`
- `architecture-review-mcp__list_pillar_configs`
- `architecture-review-mcp__list_governance_policies`

---

## 📁 생성/수정 파일 목록

| 파일 | 작업 | 상태 |
|------|------|------|
| `backend/src/mcp-server/lambda.ts` | 신규 | ✅ 완료 |
| `backend/src/mcp-server/tools.ts` | 신규 | ✅ 완료 |
| `backend/src/mcp-server/index.ts` | 신규 | ✅ 완료 |
| `infrastructure/lib/architecture-review-stack.ts` | 수정 | ✅ 완료 |
| `scripts/setup-agentcore-cognito.sh` | 신규 | ✅ 완료 |
| `scripts/setup-agentcore-gateway.sh` | 신규 | ✅ 완료 |
| `docs/QUICKSUITE-MCP-REGISTRATION.md` | 신규 | ✅ 완료 |
| `docs/MCP-LAMBDA-SETUP-PLAN.md` | 신규 | ✅ 완료 |

---

## 🔧 참조 문서

- `/Users/ironpe/playground/architecture-review-using-quicksuite-chatagent-embeding/docs/AGENTCORE_MCP_SETUP.md`
- `/Users/ironpe/playground/architecture-review-using-quicksuite-chatagent-embeding/docs/COGNITO_INTEGRATION.md`
- `/Users/ironpe/playground/architecture-review-using-quicksuite-chatagent-embeding/docs/QUICKSIGHT_SETUP.md`

---

## 📊 최종 출력 정보 (설정 완료 후)

```bash
# QuickSuite MCP Action 등록 정보
Name: Architecture Review Data MCP
URL: https://{gateway-id}.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp
Auth Type: Service authentication (2LO)
Client ID: {cognito-client-id}
Client Secret: {cognito-client-secret}
Token URL: https://{domain}.auth.us-east-1.amazoncognito.com/oauth2/token

# 사용 가능한 MCP 도구 (8개)
- list_review_requests
- get_review_request
- list_documents
- get_document
- list_review_executions
- get_review_execution
- list_pillar_configs
- list_governance_policies
```

---

**작성일**: 2026-01-14  
**상태**: ✅ 모든 단계 완료
