import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Slider,
} from '@mui/material';
import { PillarName, PillarConfig } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const PILLARS: PillarName[] = [
  'Operational Excellence',
  'Security',
  'Reliability',
  'Performance Efficiency',
  'Cost Optimization',
  'Sustainability',
];

const PILLAR_LABELS_KO: Record<PillarName, string> = {
  'Operational Excellence': '운영 우수성',
  'Security': '보안',
  'Reliability': '안정성',
  'Performance Efficiency': '성능 효율성',
  'Cost Optimization': '비용 최적화',
  'Sustainability': '지속 가능성',
};

const PILLAR_LABELS_EN: Record<PillarName, string> = {
  'Operational Excellence': 'Operational Excellence',
  'Security': 'Security',
  'Reliability': 'Reliability',
  'Performance Efficiency': 'Performance Efficiency',
  'Cost Optimization': 'Cost Optimization',
  'Sustainability': 'Sustainability',
};

// Vision 모델 옵션
const VISION_MODELS_KO = [
  {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite v1',
    description: '빠른 처리, 기본 문서 분석 (💰 저렴)',
  },
  {
    id: 'us.amazon.nova-2-lite-v1:0',
    name: 'Amazon Nova 2 Lite v1',
    description: '최신 Nova 2세대, 향상된 성능 (💰 저렴)',
  },
  {
    id: 'us.amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro v1',
    description: '향상된 정확도, 복잡한 문서 분석 (💰💰 중간)',
  },
  {
    id: 'us.mistral.pixtral-large-2502-v1:0',
    name: 'Mistral Pixtral Large',
    description: '대용량 컨텍스트, 상세 분석 (💰💰 중간)',
  },
  {
    id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude Sonnet 3.5 v2',
    description: '균형잡힌 성능, 빠른 분석 (💰💰 중간)',
  },
  {
    id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    name: 'Claude Sonnet 4.5',
    description: '최신 Sonnet, 향상된 추론 (💰💰 중간)',
  },
  {
    id: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
    name: 'Claude Opus 4.5',
    description: '최고 성능, 복잡한 추론 (💰💰💰 비쌈)',
  },
  {
    id: 'qwen.qwen3-vl-235b-a22b',
    name: 'Qwen3 VL 235B A22B',
    description: '최신 Qwen3 비전 모델, 대규모 파라미터 (💰💰 중간)',
  },
];

const VISION_MODELS_EN = [
  {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite v1',
    description: 'Fast processing, basic document analysis (💰 Low cost)',
  },
  {
    id: 'us.amazon.nova-2-lite-v1:0',
    name: 'Amazon Nova 2 Lite v1',
    description: 'Latest Nova 2nd gen, improved performance (💰 Low cost)',
  },
  {
    id: 'us.amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro v1',
    description: 'Enhanced accuracy, complex document analysis (💰💰 Medium)',
  },
  {
    id: 'us.mistral.pixtral-large-2502-v1:0',
    name: 'Mistral Pixtral Large',
    description: 'Large context, detailed analysis (💰💰 Medium)',
  },
  {
    id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude Sonnet 3.5 v2',
    description: 'Balanced performance, fast analysis (💰💰 Medium)',
  },
  {
    id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    name: 'Claude Sonnet 4.5',
    description: 'Latest Sonnet, enhanced reasoning (💰💰 Medium)',
  },
  {
    id: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
    name: 'Claude Opus 4.5',
    description: 'Best performance, complex reasoning (💰💰💰 High cost)',
  },
  {
    id: 'qwen.qwen3-vl-235b-a22b',
    name: 'Qwen3 VL 235B A22B',
    description: 'Latest Qwen3 vision model, large parameters (💰💰 Medium)',
  },
];

// Pillar 검토 모델 옵션 (Converse API 지원 - Claude + Nova)
const REVIEW_MODELS_KO = [
  {
    id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude Sonnet 3.5 v2',
    description: '균형잡힌 성능, 빠른 분석 (💰💰 중간) - 기본값',
  },
  {
    id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    name: 'Claude Sonnet 4.5',
    description: '최신 Sonnet, 향상된 추론 (💰💰 중간)',
  },
  {
    id: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
    name: 'Claude Opus 4.5',
    description: '최고 성능, 복잡한 추론 (💰💰💰 비쌈)',
  },
  {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite v1',
    description: '빠른 처리, 기본 분석 (💰 저렴)',
  },
  {
    id: 'us.amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro v1',
    description: '향상된 정확도, 복잡한 분석 (💰💰 중간)',
  },
];

const REVIEW_MODELS_EN = [
  {
    id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude Sonnet 3.5 v2',
    description: 'Balanced performance, fast analysis (💰💰 Medium) - Default',
  },
  {
    id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    name: 'Claude Sonnet 4.5',
    description: 'Latest Sonnet, enhanced reasoning (💰💰 Medium)',
  },
  {
    id: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
    name: 'Claude Opus 4.5',
    description: 'Best performance, complex reasoning (💰💰💰 High cost)',
  },
  {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite v1',
    description: 'Fast processing, basic analysis (💰 Low cost)',
  },
  {
    id: 'us.amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro v1',
    description: 'Enhanced accuracy, complex analysis (💰💰 Medium)',
  },
];

// Nova Vision 기본 프롬프트
const DEFAULT_NOVA_VISION_PROMPT = `아키텍처 다이어그램을 상세히 분석하여 구조적이고 기술적인 설명을 작성하세요.

(중요) 아래의 지침에 따라 분석하는 결과는 **반드시** 아키텍처 다이어그램/구성도에 있는 내용만 언급하세요.

# 분석 구조

## 1. 🎯 아키텍처 개요
**시스템의 목적과 전체 구조를 7문장 이내로 요약하세요.**
- 이 시스템이 해결하려는 비즈니스 문제는 무엇인가?

## 2. 🏗️ 주요 구성 요소
**다이어그램에 표시된 모든 AWS 서비스와 컴포넌트를 계층별로 그룹화하여 설명하세요.**

### 2.1 프론트엔드/사용자 계층
- 사용자 인터페이스 및 접근 방법
- CDN, API Gateway 등

### 2.2 애플리케이션 계층
- 컴퓨팅 리소스 (Lambda, ECS, EC2 등)
- 비즈니스 로직 처리
- 각 서비스의 역할과 책임

### 2.3 데이터 계층
- 데이터베이스 (RDS, DynamoDB, S3 등)
- 캐싱 계층 (ElastiCache, DAX 등)
- 데이터 저장 및 관리 전략

### 2.4 통합 및 메시징
- 서비스 간 통신 방법
- 이벤트 버스, 큐, 토픽 등

### 2.5 외부 서비스 연동
- 서드파티 서비스 (Okta, IdP, 외부 API 등)
- 연동 방법 및 프로토콜

## 3. 🔄 데이터 흐름 분석
**데이터가 시스템을 통해 어떻게 흐르는지 단계별로 설명하세요.**

### 3.1 주요 데이터 흐름 경로
1. **사용자 요청 → 응답 경로**
   - 단계별 처리 과정
   - 각 단계에서 사용되는 서비스

2. **데이터 수집 및 저장 경로**
   - 데이터 입수 방법
   - 변환 및 처리 과정
   - 최종 저장 위치

3. **배치 처리 및 분석 경로** (있는 경우)
   - 스케줄링 방법
   - 처리 파이프라인

### 3.2 데이터 흐름 특징
- 동기/비동기 처리 방식
- 데이터 변환 및 검증 지점
- 에러 처리 및 재시도 메커니즘

## 4. 🔒 보안 및 네트워크 구성
**보안 아키텍처를 상세히 설명하세요.**

### 4.1 네트워크 구조
- VPC 구성 (CIDR, Subnet 배치)
- Public/Private Subnet 분리
- NAT Gateway, Internet Gateway 배치
- Transit Gateway, VPC Peering (있는 경우)

### 4.2 보안 계층
- **인증/인가**: Cognito, IAM, 외부 IdP 등
- **네트워크 보안**: Security Group, NACL, WAF
- **데이터 보안**: 암호화 (전송 중/저장 시), KMS
- **접근 제어**: IAM 역할 및 정책, 리소스 기반 정책

### 4.3 보안 경계
- 각 계층 간 보안 경계 식별
- 신뢰 경계 (Trust Boundary) 표시

## 5. ⚡ 아키텍처 특징 및 패턴
**이 아키텍처의 주요 특징과 설계 패턴을 설명하세요.**

### 5.1 설계 패턴
- 사용된 아키텍처 패턴 (예: CQRS, Event Sourcing, Saga 등)
- 마이크로서비스 경계 (있는 경우)
- API 설계 패턴

### 5.2 고가용성 및 확장성
- 다중 AZ 배포
- Auto Scaling 구성
- 로드 밸런싱 전략
- 장애 조치 메커니즘

### 5.3 성능 최적화
- 캐싱 전략
- 비동기 처리
- 데이터베이스 최적화

### 5.4 운영 및 모니터링
- 로깅 및 모니터링 (CloudWatch, X-Ray 등)
- 알람 및 알림
- 백업 및 복구 전략

## 6. 📊 기술 스택 요약
**사용된 모든 AWS 서비스를 카테고리별로 정리하세요.**

| 카테고리 | 서비스 | 용도 |
|---------|--------|------|
| 컴퓨팅 | Lambda, ECS 등 | 애플리케이션 실행 |
| 스토리지 | S3, EBS 등 | 데이터 저장 |
| 데이터베이스 | RDS, DynamoDB 등 | 데이터 관리 |
| 네트워킹 | VPC, ALB 등 | 네트워크 구성 |
| 보안 | IAM, KMS 등 | 보안 관리 |

---

**작성 지침:**
1. **구조적 작성**: 위 구조를 따라 체계적으로 작성
2. **기술적 정확성**: AWS 서비스명, 설정, 구성을 정확히 기술
3. **가독성**: 마크다운 형식 활용 (제목, 리스트, 표, 강조)
4. **구체성**: "여러 서비스" 대신 구체적인 서비스명 사용
5. **한글 작성**: AWS 서비스명은 영문 유지, 설명은 한글
6. **다이어그램 충실**: 다이어그램에 표시된 한글 레이블과 텍스트를 정확히 읽고 반영

**중요**: 다이어그램의 모든 화살표, 연결선, 레이블을 주의 깊게 관찰하고 데이터 흐름을 정확히 파악하세요.

위 구조에 따라 아키텍처 다이어그램을 상세히 분석하세요:`;

// Default prompts matching backend
function getDefaultPrompt(pillarName: PillarName): string {
  const prompts: Record<PillarName, string> = {
    'Operational Excellence': `당신은 AWS Well-Architected Framework의 운영 우수성(Operational Excellence) Pillar 전문가입니다.

제공된 아키텍처 문서를 다음 핵심 영역을 기준으로 검토하세요:

1. 조직 (Organization)
   - 팀 구조와 역할/책임이 명확한가?
   - 비즈니스 목표와 우선순위가 정의되어 있는가?

2. 준비 (Prepare)
   - 운영 준비 상태 검토 프로세스가 있는가?
   - 설계 표준과 모범 사례가 적용되었는가?
   - 구성 관리 및 변경 관리 프로세스가 있는가?

3. 운영 (Operate)
   - 워크로드 상태를 이해하기 위한 관찰 가능성(Observability)이 확보되었는가?
   - 메트릭, 로그, 트레이스 수집 전략이 있는가?
   - 이벤트 대응 및 알림 체계가 구축되었는가?

4. 진화 (Evolve)
   - 지속적 개선 메커니즘이 있는가?
   - 운영 메트릭을 기반으로 개선하는가?
   - 학습 문화와 피드백 루프가 있는가?

구체적이고 실행 가능한 권장사항을 제공하세요.`,

    'Security': `당신은 AWS Well-Architected Framework의 보안(Security) Pillar 전문가입니다.

제공된 아키텍처 문서를 다음 핵심 영역을 기준으로 검토하세요:

1. 보안 기반 (Security Foundations)
   - 보안 거버넌스와 책임 소재가 명확한가?
   - 보안 목표와 요구사항이 정의되어 있는가?

2. 자격 증명 및 액세스 관리 (Identity and Access Management)
   - 최소 권한 원칙이 적용되었는가?
   - 강력한 인증 메커니즘(MFA 등)이 있는가?
   - 임시 자격 증명을 사용하는가?
   - 권한 관리가 중앙화되어 있는가?

3. 탐지 (Detection)
   - 로깅 및 모니터링이 구성되었는가?
   - 보안 이벤트 탐지 메커니즘이 있는가?
   - 이상 징후 탐지 기능이 있는가?

4. 인프라 보호 (Infrastructure Protection)
   - 네트워크 계층 보호(VPC, 보안 그룹, NACL)가 적절한가?
   - 경계 보호(WAF, Shield)가 구현되었는가?
   - 컴퓨팅 리소스 보호가 적절한가?

5. 데이터 보호 (Data Protection)
   - 전송 중 데이터 암호화(TLS)가 적용되었는가?
   - 저장 데이터 암호화가 적용되었는가?
   - 데이터 분류 및 보호 수준이 정의되었는가?
   - 백업 및 복구 전략이 있는가?

6. 인시던트 대응 (Incident Response)
   - 인시던트 대응 계획이 수립되어 있는가?
   - 자동화된 대응 메커니즘이 있는가?

구체적이고 실행 가능한 권장사항을 제공하세요.`,

    'Reliability': `당신은 AWS Well-Architected Framework의 안정성(Reliability) Pillar 전문가입니다.

제공된 아키텍처 문서를 다음 핵심 영역을 기준으로 검토하세요:

1. 기반 (Foundations)
   - 서비스 할당량과 제약사항을 고려했는가?
   - 네트워크 토폴로지가 안정성을 지원하는가?
   - 다중 AZ 또는 다중 리전 전략이 있는가?

2. 워크로드 아키텍처 (Workload Architecture)
   - 분산 시스템 설계 원칙이 적용되었는가?
   - 느슨한 결합(Loose Coupling)이 구현되었는가?
   - 장애 격리 경계가 정의되었는가?
   - 서비스 간 통신의 안정성이 보장되는가?

3. 변경 관리 (Change Management)
   - 배포 파이프라인이 자동화되었는가?
   - 롤백 메커니즘이 있는가?
   - 카나리 배포 또는 블루/그린 배포 전략이 있는가?

4. 장애 관리 (Failure Management)
   - 장애 시나리오가 식별되었는가?
   - 자동 복구 메커니즘이 있는가?
   - 백업 및 재해 복구 전략이 수립되었는가?
   - RTO/RPO 목표가 정의되었는가?
   - 헬스 체크와 자동 스케일링이 구성되었는가?

5. 테스트 (Testing)
   - 장애 주입 테스트(Chaos Engineering)를 수행하는가?
   - 부하 테스트와 복원력 테스트가 계획되었는가?

구체적이고 실행 가능한 권장사항을 제공하세요.`,

    'Performance Efficiency': `당신은 AWS Well-Architected Framework의 성능 효율성(Performance Efficiency) Pillar 전문가입니다.

제공된 아키텍처 문서를 다음 핵심 영역을 기준으로 검토하세요:

1. 아키텍처 선택 (Architecture Selection)
   - 데이터 기반 접근 방식으로 아키텍처를 선택했는가?
   - 벤치마킹과 부하 테스트를 수행했는가?

2. 컴퓨팅 (Compute)
   - 워크로드에 적합한 컴퓨팅 리소스를 선택했는가?
   - 인스턴스 유형, 컨테이너, 서버리스 중 최적의 선택인가?
   - 오토 스케일링이 적절히 구성되었는가?

3. 스토리지 (Storage)
   - 액세스 패턴에 맞는 스토리지 솔루션을 선택했는가?
   - S3 스토리지 클래스, EBS 볼륨 타입이 적절한가?
   - 데이터 라이프사이클 정책이 있는가?

4. 데이터베이스 (Database)
   - 워크로드에 적합한 데이터베이스 엔진을 선택했는가?
   - 읽기/쓰기 패턴에 최적화되었는가?
   - 캐싱 전략이 적용되었는가?

5. 네트워크 (Network)
   - 네트워크 대역폭과 지연시간이 최적화되었는가?
   - CDN 사용이 고려되었는가?
   - 리전 및 AZ 배치가 최적인가?

6. 모니터링 (Monitoring)
   - 성능 메트릭을 지속적으로 모니터링하는가?
   - 성능 저하를 조기에 감지할 수 있는가?

7. 트레이드오프 (Trade-offs)
   - 일관성, 내구성, 공간, 시간 간의 트레이드오프를 고려했는가?

구체적이고 실행 가능한 권장사항을 제공하세요.`,

    'Cost Optimization': `당신은 AWS Well-Architected Framework의 비용 최적화(Cost Optimization) Pillar 전문가입니다.

제공된 아키텍처 문서를 다음 핵심 영역을 기준으로 검토하세요:

1. 클라우드 재무 관리 (Cloud Financial Management)
   - 비용 인식 문화가 조직에 구축되어 있는가?
   - 비용 최적화 책임이 명확한가?

2. 지출 및 사용량 인식 (Expenditure and Usage Awareness)
   - 비용 가시성과 투명성이 확보되었는가?
   - 태깅 전략으로 비용을 추적하는가?
   - 비용 이상 징후를 모니터링하는가?

3. 비용 효율적인 리소스 (Cost-Effective Resources)
   - 적절한 서비스를 선택했는가?
   - 적절한 리소스 타입과 크기를 선택했는가?
   - 요금 모델(On-Demand, Reserved, Spot)을 최적화했는가?
   - Savings Plans 또는 Reserved Instances를 활용하는가?

4. 수요와 공급 관리 (Manage Demand and Supply)
   - 수요 기반 리소스 프로비저닝이 구현되었는가?
   - 오토 스케일링이 적절히 구성되었는가?
   - 버퍼 또는 스로틀링 전략이 있는가?

5. 시간 경과에 따른 최적화 (Optimize Over Time)
   - 정기적인 비용 검토 프로세스가 있는가?
   - 새로운 AWS 서비스와 기능을 평가하는가?
   - 사용하지 않는 리소스를 식별하고 제거하는가?

구체적이고 실행 가능한 권장사항을 제공하세요.`,

    'Sustainability': `당신은 AWS Well-Architected Framework의 지속 가능성(Sustainability) Pillar 전문가입니다.

제공된 아키텍처 문서를 다음 핵심 영역을 기준으로 검토하세요:

1. 리전 선택 (Region Selection)
   - 탄소 배출이 낮은 리전을 선택했는가?
   - 사용자 근접성과 지속 가능성의 균형을 고려했는가?

2. 사용자 행동 패턴 (User Behavior Patterns)
   - 사용자 영향을 최소화하면서 지속 가능성을 개선할 수 있는가?
   - 불필요한 데이터 전송을 줄이는 전략이 있는가?

3. 소프트웨어 및 아키텍처 패턴 (Software and Architecture)
   - 효율적인 코드와 알고리즘을 사용하는가?
   - 비동기 처리와 이벤트 기반 아키텍처를 활용하는가?
   - 서버리스 또는 관리형 서비스를 우선 고려했는가?

4. 데이터 패턴 (Data Patterns)
   - 데이터 분류 및 라이프사이클 정책이 있는가?
   - 불필요한 데이터 저장을 최소화하는가?
   - 데이터 압축과 중복 제거를 활용하는가?

5. 하드웨어 패턴 (Hardware Patterns)
   - 최소한의 리소스로 요구사항을 충족하는가?
   - 최신 세대의 효율적인 인스턴스를 사용하는가?
   - Graviton 프로세서 사용을 고려했는가?

6. 개발 및 배포 프로세스 (Development and Deployment)
   - 개발/테스트 환경의 리소스 사용을 최적화하는가?
   - CI/CD 파이프라인이 효율적인가?

구체적이고 실행 가능한 권장사항을 제공하세요.`,
  };

  return prompts[pillarName];
}

export function AgentConfigPage() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [configs, setConfigs] = useState<Record<PillarName, PillarConfig>>({} as any);
  const [novaVisionModelId, setNovaVisionModelId] = useState('us.amazon.nova-lite-v1:0');
  const [novaVisionMaxTokens, setNovaVisionMaxTokens] = useState(8192);
  const [novaVisionTemperature, setNovaVisionTemperature] = useState(0.3);
  const [novaVisionPrompt, setNovaVisionPrompt] = useState(DEFAULT_NOVA_VISION_PROMPT);
  const [reviewModelId, setReviewModelId] = useState('us.anthropic.claude-3-5-sonnet-20241022-v2:0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const { language } = useLanguage();

  const PILLAR_LABELS = language === 'ko' ? PILLAR_LABELS_KO : PILLAR_LABELS_EN;
  const VISION_MODELS = language === 'ko' ? VISION_MODELS_KO : VISION_MODELS_EN;
  const REVIEW_MODELS = language === 'ko' ? REVIEW_MODELS_KO : REVIEW_MODELS_EN;

  useEffect(() => {
    loadConfigs();
    loadNovaVisionPrompt();
    loadReviewModelConfig();
  }, []);

  const loadNovaVisionPrompt = async () => {
    try {
      const config = await api.getNovaVisionConfig();
      console.log('Loaded Vision config from API:', config);
      setNovaVisionModelId(config.modelId);
      setNovaVisionMaxTokens(config.maxTokens);
      setNovaVisionTemperature(config.temperature);
      setNovaVisionPrompt(config.systemPrompt);
      console.log('Set state:', {
        modelId: config.modelId,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      });
    } catch (error) {
      console.warn('Failed to load Nova Vision config, using default');
      setNovaVisionModelId('us.amazon.nova-lite-v1:0');
      setNovaVisionMaxTokens(8192);
      setNovaVisionTemperature(0.3);
      setNovaVisionPrompt(DEFAULT_NOVA_VISION_PROMPT);
    }
  };

  const loadReviewModelConfig = async () => {
    try {
      const config = await api.getPillarReviewModelConfig();
      console.log('Loaded Review Model config:', config);
      setReviewModelId(config.modelId);
    } catch (error: any) {
      console.error('Failed to load Review Model config:', error.response?.status, error.response?.data, error.message);
      setReviewModelId('us.anthropic.claude-3-5-sonnet-20241022-v2:0');
    }
  };

  const saveReviewModelConfig = async () => {
    try {
      setSaving(true);
      console.log('Saving Review Model config:', { modelId: reviewModelId });
      await api.updatePillarReviewModelConfig(reviewModelId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Save Review Model error:', err.response?.status, err.response?.data, err.message);
      const status = err.response?.status ? ` (${err.response.status})` : '';
      setError(err.response?.data?.error || `${err.message}${status}` || (language === 'ko' ? 'Pillar 검토 모델 저장에 실패했습니다' : 'Failed to save pillar review model'));
    } finally {
      setSaving(false);
    }
  };

  const saveNovaVisionPrompt = async () => {
    try {
      setSaving(true);
      console.log('Saving Vision config:', {
        modelId: novaVisionModelId,
        maxTokens: novaVisionMaxTokens,
        temperature: novaVisionTemperature,
      });
      await api.updateNovaVisionConfig(
        novaVisionModelId,
        novaVisionMaxTokens,
        novaVisionTemperature,
        novaVisionPrompt,
        true
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Nova Vision 프롬프트 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const result = await api.getPillars();
      const configMap: Record<PillarName, PillarConfig> = {} as any;
      result.pillars.forEach(config => {
        configMap[config.pillarName] = config;
      });
      setConfigs(configMap);
    } catch (err: any) {
      // Fallback to default configs
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        console.warn('API not available, using default configs');
        const defaultConfigs: Record<PillarName, PillarConfig> = {} as any;
        PILLARS.forEach(pillar => {
          defaultConfigs[pillar] = {
            pillarName: pillar,
            systemPrompt: getDefaultPrompt(pillar),
            enabled: true,
          };
        });
        setConfigs(defaultConfigs);
      } else {
        setError(err.response?.data?.error || 'Pillar 설정을 불러오는데 실패했습니다');
      }
    } finally {
      setLoading(false);
    }
  };

  const currentPillar = PILLARS[selectedTab - 2]; // -2 because first tab is Vision, second is Review Model
  const currentConfig = selectedTab > 1 ? configs[currentPillar] : null;

  const handleSave = async () => {
    if (!currentConfig) return;

    try {
      setSaving(true);
      await api.updatePillar(currentPillar, {
        systemPrompt: currentConfig.systemPrompt,
        enabled: currentConfig.enabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || (language === 'ko' ? '저장에 실패했습니다' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handlePromptChange = (value: string) => {
    setConfigs(prev => ({
      ...prev,
      [currentPillar]: {
        ...prev[currentPillar],
        systemPrompt: value,
      },
    }));
  };

  const handleEnabledToggle = () => {
    setConfigs(prev => ({
      ...prev,
      [currentPillar]: {
        ...prev[currentPillar],
        enabled: !prev[currentPillar].enabled,
      },
    }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700} sx={{ mb: 3 }}>
        {language === 'ko' ? '아키텍처 리뷰 에이전트 설정' : 'Architecture Review Agent Configuration'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={selectedTab}
          onChange={(_, newValue) => setSelectedTab(newValue)}
          variant="fullWidth"
          scrollButtons={false}
        >
          <Tab label={language === 'ko' ? '아키텍처 분석' : 'Architecture Analysis'} />
          <Tab label={language === 'ko' ? 'Pillar 검토 모델' : 'Pillar Review Model'} />
          {PILLARS.map((pillar) => (
            <Tab key={pillar} label={PILLAR_LABELS[pillar]} />
          ))}
        </Tabs>
      </Paper>

      {/* Nova Vision 탭 */}
      {selectedTab === 0 && (
        <Paper sx={{ p: 3 }}>
          {saved && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>
              {language === 'ko' ? '아키텍처 분석 설정이 저장되었습니다.' : 'Architecture analysis settings saved.'}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {language === 'ko' ? '아키텍처 분석 설정' : 'Architecture Analysis Settings'}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'left' }}>
            {language === 'ko' 
              ? '아키텍처 다이어그램을 분석하는 Vision 모델과 프롬프트를 설정하세요. 이 설정은 "아키텍처 분석" 탭에 표시되는 내용을 생성합니다.'
              : 'Configure the Vision model and prompt for analyzing architecture diagrams. These settings generate the content displayed in the "Architecture Analysis" tab.'}
          </Typography>

          {/* 모델 선택 */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>{language === 'ko' ? 'Vision 모델' : 'Vision Model'}</InputLabel>
            <Select
              value={novaVisionModelId || 'us.amazon.nova-lite-v1:0'}
              onChange={(e) => setNovaVisionModelId(e.target.value)}
              label={language === 'ko' ? 'Vision 모델' : 'Vision Model'}
            >
              {VISION_MODELS.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  <Box>
                    <Typography variant="body1">{model.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {model.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Max Tokens와 Temperature를 나란히 배치 */}
          <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
            {/* Max Tokens */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" gutterBottom>
                Max Tokens: {novaVisionMaxTokens ?? 8192}
              </Typography>
              <TextField
                fullWidth
                type="number"
                value={novaVisionMaxTokens ?? 8192}
                onChange={(e) => setNovaVisionMaxTokens(Number(e.target.value))}
                inputProps={{ min: 1024, max: 16384, step: 1024 }}
                helperText={language === 'ko' ? '1024 - 16384 범위' : 'Range: 1024 - 16384'}
              />
            </Box>

            {/* Temperature */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" gutterBottom>
                Temperature: {novaVisionTemperature?.toFixed(1) ?? '0.3'}
              </Typography>
              <Slider
                value={novaVisionTemperature ?? 0.3}
                onChange={(_, value) => setNovaVisionTemperature(value as number)}
                min={0}
                max={1}
                step={0.1}
                marks={[
                  { value: 0, label: '0.0' },
                  { value: 0.3, label: '0.3' },
                  { value: 0.5, label: '0.5' },
                  { value: 0.7, label: '0.7' },
                  { value: 1, label: '1.0' },
                ]}
                valueLabelDisplay="auto"
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {language === 'ko' ? '낮을수록 일관성 있고 결정적, 높을수록 창의적' : 'Lower = more consistent, Higher = more creative'}
              </Typography>
            </Box>
          </Box>

          {/* 프롬프트 */}
          <Typography variant="body2" gutterBottom fontWeight={600}>
            {language === 'ko' ? '분석 프롬프트' : 'Analysis Prompt'}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={20}
            value={novaVisionPrompt}
            onChange={(e) => setNovaVisionPrompt(e.target.value)}
            variant="outlined"
            placeholder={DEFAULT_NOVA_VISION_PROMPT}
            sx={{ mb: 2, fontFamily: 'monospace', fontSize: '0.9rem' }}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="secondary"
              onClick={saveNovaVisionPrompt}
              disabled={saving}
            >
              {saving ? (language === 'ko' ? '저장 중...' : 'Saving...') : (language === 'ko' ? '저장' : 'Save')}
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setNovaVisionModelId('us.amazon.nova-lite-v1:0');
                setNovaVisionMaxTokens(8192);
                setNovaVisionTemperature(0.3);
                setNovaVisionPrompt(DEFAULT_NOVA_VISION_PROMPT);
              }}
            >
              {language === 'ko' ? '기본값으로 초기화' : 'Reset to Default'}
            </Button>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>{language === 'ko' ? '참고:' : 'Note:'}</strong> {language === 'ko' ? '설정 변경 사항은 다음 검토부터 적용됩니다.' : 'Changes will be applied from the next review.'}
            </Typography>
          </Alert>
        </Paper>
      )}

      {/* Pillar 검토 모델 탭 */}
      {selectedTab === 1 && (
        <Paper sx={{ p: 3 }}>
          {saved && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>
              {language === 'ko' ? 'Pillar 검토 모델 설정이 저장되었습니다.' : 'Pillar review model settings saved.'}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {language === 'ko' ? 'Pillar 검토 모델 설정' : 'Pillar Review Model Settings'}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'left' }}>
            {language === 'ko'
              ? '6개 Well-Architected Pillar 검토와 Executive Summary 생성에 사용되는 AI 모델을 설정합니다. 이 모델은 아키텍처 다이어그램 분석(Vision 모델)과는 별도로 동작합니다.'
              : 'Configure the AI model used for the 6 Well-Architected Pillar reviews and Executive Summary generation. This model operates separately from the architecture diagram analysis (Vision model).'}
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>{language === 'ko' ? 'Pillar 검토 모델' : 'Pillar Review Model'}</InputLabel>
            <Select
              value={reviewModelId}
              onChange={(e) => setReviewModelId(e.target.value)}
              label={language === 'ko' ? 'Pillar 검토 모델' : 'Pillar Review Model'}
            >
              {REVIEW_MODELS.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  <Box>
                    <Typography variant="body1">{model.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {model.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="secondary"
              onClick={saveReviewModelConfig}
              disabled={saving}
            >
              {saving ? (language === 'ko' ? '저장 중...' : 'Saving...') : (language === 'ko' ? '저장' : 'Save')}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setReviewModelId('us.anthropic.claude-3-5-sonnet-20241022-v2:0')}
            >
              {language === 'ko' ? '기본값으로 초기화' : 'Reset to Default'}
            </Button>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>{language === 'ko' ? '참고:' : 'Note:'}</strong> {language === 'ko'
                ? '이 모델은 6개 Pillar 검토(운영 우수성, 보안, 안정성, 성능 효율성, 비용 최적화, 지속 가능성)와 Executive Summary 생성에 사용됩니다. 아키텍처 다이어그램 분석에는 "아키텍처 분석" 탭에서 설정한 Vision 모델이 사용됩니다.'
                : 'This model is used for the 6 Pillar reviews (Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability) and Executive Summary generation. The Vision model configured in the "Architecture Analysis" tab is used for architecture diagram analysis.'}
            </Typography>
          </Alert>
        </Paper>
      )}

      {/* Pillar 탭들 */}
      {selectedTab > 1 && currentConfig && (
        <Paper sx={{ p: 3 }}>
          {saved && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>
              {language === 'ko' ? `${PILLAR_LABELS[currentPillar]} 프롬프트가 저장되었습니다.` : `${currentPillar} prompt saved.`}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {PILLAR_LABELS[currentPillar]} ({currentPillar})
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={currentConfig.enabled}
                  onChange={handleEnabledToggle}
                  color="success"
                />
              }
              label={currentConfig.enabled ? (language === 'ko' ? '활성' : 'Enabled') : (language === 'ko' ? '비활성' : 'Disabled')}
            />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
            {language === 'ko' 
              ? '이 원칙을 검토하는 AI 에이전트가 사용할 시스템 프롬프트를 설정하세요.'
              : 'Configure the system prompt for the AI agent reviewing this pillar.'}
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={15}
            value={currentConfig.systemPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            variant="outlined"
            sx={{ mb: 2, fontFamily: 'monospace' }}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (language === 'ko' ? '저장 중...' : 'Saving...') : (language === 'ko' ? '저장' : 'Save')}
            </Button>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>{language === 'ko' ? '참고:' : 'Note:'}</strong> {language === 'ko' 
                ? '프롬프트 변경 사항은 다음 검토부터 적용됩니다. 이전 버전은 히스토리에서 확인할 수 있습니다.'
                : 'Prompt changes will be applied from the next review. Previous versions can be found in the history.'}
            </Typography>
          </Alert>
        </Paper>
      )}
    </Box>
  );
}
