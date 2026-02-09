/**
 * Pillar Configuration Service
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { environment } from '../config/environment.js';
import {
  PillarName,
  PillarConfig,
  PillarConfigurationRecord,
  PromptVersion,
  NotFoundError,
} from '../types/index.js';
import { validatePillarName, validateRequiredString } from '../utils/validators.js';

export class PillarConfigurationService {
  private dynamoClient: DynamoDBDocumentClient;
  private pillarConfigurationsTable: string;

  constructor() {
    const ddbClient = new DynamoDBClient({ region: environment.aws.region });
    this.dynamoClient = DynamoDBDocumentClient.from(ddbClient);
    this.pillarConfigurationsTable = environment.dynamodb.pillarConfigurationsTable;
  }

  /**
   * Get all pillar configurations (latest active versions)
   * Requirements: 3.1
   */
  async getAllPillars(): Promise<PillarConfig[]> {
    const pillars: PillarName[] = [
      'Operational Excellence',
      'Security',
      'Reliability',
      'Performance Efficiency',
      'Cost Optimization',
      'Sustainability',
    ];

    const configs: PillarConfig[] = [];

    for (const pillar of pillars) {
      try {
        const config = await this.getActivePillarConfig(pillar);
        configs.push(config);
      } catch (error) {
        // If no config exists, use default
        console.warn(`No config found for ${pillar}, using default`);
        configs.push({
          pillarName: pillar,
          systemPrompt: this.getDefaultPrompt(pillar),
          enabled: true,
        });
      }
    }

    return configs;
  }

  /**
   * Get Nova Vision configuration
   */
  async getNovaVisionConfig(): Promise<{
    modelId: string;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
    enabled: boolean;
  }> {
    try {
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.pillarConfigurationsTable,
          KeyConditionExpression: 'PK = :pk',
          FilterExpression: 'isActive = :active',
          ExpressionAttributeValues: {
            ':pk': 'VISION#NOVA',
            ':active': true,
          },
          ScanIndexForward: false,
          Limit: 1,
        })
      );

      if (result.Items && result.Items.length > 0) {
        const record = result.Items[0] as any;
        
        // Return with defaults if fields are missing
        return {
          modelId: record.modelId || 'us.amazon.nova-lite-v1:0',
          maxTokens: record.maxTokens ? Number(record.maxTokens) : 8192,
          temperature: record.temperature !== undefined ? Number(record.temperature) : 0.3,
          systemPrompt: record.systemPrompt || this.getDefaultNovaVisionPrompt(),
          enabled: record.enabled !== false,
        };
      }
    } catch (error) {
      console.warn('No Nova Vision config found, using default');
    }

    // Return defaults if no record found
    return {
      modelId: 'us.amazon.nova-lite-v1:0',
      maxTokens: 8192,
      temperature: 0.3,
      systemPrompt: this.getDefaultNovaVisionPrompt(),
      enabled: true,
    };
  }

  /**
   * Update Nova Vision configuration
   */
  async updateNovaVisionConfig(
    modelId: string,
    maxTokens: number,
    temperature: number,
    systemPrompt: string,
    enabled: boolean,
    createdBy: string
  ): Promise<void> {
    validateRequiredString(systemPrompt, 'systemPrompt');
    validateRequiredString(createdBy, 'createdBy');

    const timestamp = new Date().toISOString();

    // Deactivate previous versions
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.pillarConfigurationsTable,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'VISION#NOVA',
        },
      })
    );

    if (result.Items) {
      for (const item of result.Items) {
        if ((item as any).isActive) {
          await this.dynamoClient.send(
            new PutCommand({
              TableName: this.pillarConfigurationsTable,
              Item: {
                ...item,
                isActive: false,
              },
            })
          );
        }
      }
    }

    // Create new version
    const newRecord: any = {
      PK: 'VISION#NOVA',
      SK: `VERSION#${timestamp}`,
      pillarName: 'Nova Vision',
      modelId,
      maxTokens,
      temperature,
      systemPrompt,
      enabled,
      createdBy,
      createdAt: timestamp,
      isActive: true,
    };

    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.pillarConfigurationsTable,
        Item: newRecord,
      })
    );
  }

  /**
   * Get Pillar Review Model configuration
   */
  async getPillarReviewModelConfig(): Promise<{
    modelId: string;
  }> {
    try {
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.pillarConfigurationsTable,
          KeyConditionExpression: 'PK = :pk',
          FilterExpression: 'isActive = :active',
          ExpressionAttributeValues: {
            ':pk': 'CONFIG#REVIEW_MODEL',
            ':active': true,
          },
          ScanIndexForward: false,
          Limit: 1,
        })
      );

      if (result.Items && result.Items.length > 0) {
        const record = result.Items[0] as any;
        return {
          modelId: record.modelId || environment.bedrock.modelId,
        };
      }
    } catch (error) {
      console.warn('No Pillar Review Model config found, using default');
    }

    return {
      modelId: environment.bedrock.modelId,
    };
  }

  /**
   * Update Pillar Review Model configuration
   */
  async updatePillarReviewModelConfig(
    modelId: string,
    createdBy: string
  ): Promise<void> {
    validateRequiredString(modelId, 'modelId');
    validateRequiredString(createdBy, 'createdBy');

    const timestamp = new Date().toISOString();

    // Deactivate previous versions
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.pillarConfigurationsTable,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'CONFIG#REVIEW_MODEL',
        },
      })
    );

    if (result.Items) {
      for (const item of result.Items) {
        if ((item as any).isActive) {
          await this.dynamoClient.send(
            new PutCommand({
              TableName: this.pillarConfigurationsTable,
              Item: {
                ...item,
                isActive: false,
              },
            })
          );
        }
      }
    }

    // Create new version
    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.pillarConfigurationsTable,
        Item: {
          PK: 'CONFIG#REVIEW_MODEL',
          SK: `VERSION#${timestamp}`,
          pillarName: 'Review Model',
          modelId,
          createdBy,
          createdAt: timestamp,
          isActive: true,
        },
      })
    );
  }

  /**
   * Get active configuration for a specific pillar
   * Requirements: 3.1
   */
  async getActivePillarConfig(pillarName: PillarName): Promise<PillarConfig> {
    validatePillarName(pillarName);

    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.pillarConfigurationsTable,
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'isActive = :active',
        ExpressionAttributeValues: {
          ':pk': `PILLAR#${pillarName}`,
          ':active': true,
        },
        ScanIndexForward: false, // Most recent first
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      throw new NotFoundError(`Active configuration for pillar ${pillarName} not found`);
    }

    const record = result.Items[0] as PillarConfigurationRecord;
    return {
      pillarName: record.pillarName as PillarName,
      systemPrompt: record.systemPrompt,
      enabled: record.enabled,
    };
  }

  /**
   * Update pillar configuration
   * Requirements: 3.3, 3.5
   */
  async updatePillarConfig(
    pillarName: PillarName,
    systemPrompt: string,
    enabled: boolean,
    createdBy: string
  ): Promise<void> {
    validatePillarName(pillarName);
    validateRequiredString(systemPrompt, 'systemPrompt');
    validateRequiredString(createdBy, 'createdBy');

    const timestamp = new Date().toISOString();

    // Deactivate previous versions
    const previousVersions = await this.getPillarHistory(pillarName);
    for (const version of previousVersions) {
      if (version.isActive) {
        await this.dynamoClient.send(
          new PutCommand({
            TableName: this.pillarConfigurationsTable,
            Item: {
              PK: `PILLAR#${pillarName}`,
              SK: `VERSION#${version.createdAt}`,
              pillarName: version.pillarName,
              systemPrompt: version.systemPrompt,
              enabled: version.isActive,
              createdBy: version.createdBy,
              createdAt: version.createdAt,
              isActive: false, // Deactivate
            },
          })
        );
      }
    }

    // Create new version
    const newRecord: PillarConfigurationRecord = {
      PK: `PILLAR#${pillarName}`,
      SK: `VERSION#${timestamp}`,
      pillarName,
      systemPrompt,
      enabled,
      createdBy,
      createdAt: timestamp,
      isActive: true,
    };

    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.pillarConfigurationsTable,
        Item: newRecord,
      })
    );
  }

  /**
   * Get prompt history for a pillar
   * Requirements: 3.5
   */
  async getPillarHistory(pillarName: PillarName): Promise<PromptVersion[]> {
    validatePillarName(pillarName);

    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.pillarConfigurationsTable,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `PILLAR#${pillarName}`,
        },
        ScanIndexForward: false, // Most recent first
      })
    );

    if (!result.Items) {
      return [];
    }

    return result.Items.map(item => {
      const record = item as PillarConfigurationRecord;
      return {
        pillarName: record.pillarName as PillarName,
        systemPrompt: record.systemPrompt,
        createdBy: record.createdBy,
        createdAt: record.createdAt,
        isActive: record.isActive,
      };
    });
  }

  /**
   * Get default system prompt for a pillar
   * Requirements: 3.2
   */
  private getDefaultPrompt(pillarName: PillarName): string {
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

  /**
   * Get default Nova Vision prompt
   */
  private getDefaultNovaVisionPrompt(): string {
    return `아키텍처 다이어그램을 상세히 분석하여 구조적이고 기술적인 설명을 작성하세요.

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
  }

  /**
   * Initialize default configurations for all pillars
   * Requirements: 3.2
   */
  async initializeDefaultConfigs(createdBy: string = 'system'): Promise<void> {
    const pillars: PillarName[] = [
      'Operational Excellence',
      'Security',
      'Reliability',
      'Performance Efficiency',
      'Cost Optimization',
      'Sustainability',
    ];

    for (const pillar of pillars) {
      try {
        // Check if config already exists
        await this.getActivePillarConfig(pillar);
        console.log(`Config for ${pillar} already exists, skipping`);
      } catch (error) {
        // Create default config
        await this.updatePillarConfig(
          pillar,
          this.getDefaultPrompt(pillar),
          true,
          createdBy
        );
        console.log(`Created default config for ${pillar}`);
      }
    }
  }
}
