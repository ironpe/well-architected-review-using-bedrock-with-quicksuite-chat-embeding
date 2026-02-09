import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'ko' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Korean translations
const ko: Record<string, string> = {
  // Common
  'common.appName': 'AWS 아키텍처 리뷰',
  'common.loading': '로딩 중...',
  'common.save': '저장',
  'common.cancel': '취소',
  'common.delete': '삭제',
  'common.edit': '편집',
  'common.submit': '제출',
  'common.back': '뒤로',
  'common.next': '다음',
  'common.close': '닫기',
  'common.search': '검색',
  'common.filter': '필터',
  'common.reset': '초기화',
  'common.confirm': '확인',
  'common.yes': '예',
  'common.no': '아니오',
  'common.error': '오류',
  'common.success': '성공',
  'common.warning': '경고',
  'common.info': '정보',
  'common.requester': '제출자',
  'common.reviewer': '검토자',

  // Navigation
  'nav.home': '홈',
  'nav.upload': '문서 업로드',
  'nav.myRequests': '내 요청',
  'nav.history': '검토 히스토리',
  'nav.dashboard': '대시보드',
  'nav.agentConfig': '에이전트 설정',
  'nav.policyManagement': '거버넌스 정책',
  'nav.logout': '로그아웃',

  // Login Page
  'login.title': '로그인',
  'login.email': '이메일',
  'login.password': '비밀번호',
  'login.submit': '로그인',
  'login.error': '로그인에 실패했습니다',
  'login.welcome': 'AWS 아키텍처 리뷰 시스템에 오신 것을 환영합니다',

  // Home Page
  'home.title': 'AWS 아키텍처 리뷰',
  'home.subtitle': 'AI 기반 아키텍처 검토 시스템',
  'home.description': 'AWS Well-Architected Framework를 기반으로 아키텍처를 자동으로 검토합니다.',
  'home.startReview': '검토 시작하기',
  'home.viewHistory': '검토 히스토리 보기',
  'home.features.upload': '문서 업로드',
  'home.features.uploadDesc': 'PDF 형식의 아키텍처 문서를 업로드하세요',
  'home.features.review': 'AI 검토',
  'home.features.reviewDesc': '6개 Well-Architected 원칙에 따라 자동 검토',
  'home.features.report': '리포트 생성',
  'home.features.reportDesc': '상세한 검토 결과와 권장사항 제공',

  // Upload Page
  'upload.title': '아키텍처 문서 업로드',
  'upload.dragDrop': '파일을 여기에 드래그하거나 클릭하여 업로드',
  'upload.selectFile': '파일 선택',
  'upload.supportedFormats': '지원 형식: PDF',
  'upload.maxSize': '최대 파일 크기: 10MB',
  'upload.documentName': '문서 이름',
  'upload.description': '설명 (선택사항)',
  'upload.architecturePages': '아키텍처 다이어그램 페이지',
  'upload.architecturePagesHint': '아키텍처 다이어그램이 있는 페이지 번호를 입력하세요 (예: 3, 5, 7)',
  'upload.submit': '업로드 및 검토 요청',
  'upload.success': '문서가 성공적으로 업로드되었습니다',
  'upload.error': '업로드에 실패했습니다',

  // My Requests Page
  'myRequests.title': '내 검토 요청',
  'myRequests.noRequests': '검토 요청이 없습니다',
  'myRequests.status': '상태',
  'myRequests.createdAt': '생성일',
  'myRequests.viewDetails': '상세 보기',

  // History Page
  'history.title': '검토 히스토리',
  'history.noHistory': '검토 히스토리가 없습니다',
  'history.documentName': '문서명',
  'history.reviewer': '검토자',
  'history.completedAt': '완료일',
  'history.score': '점수',

  // Review Results Page
  'results.title': '검토 결과',
  'results.summary': '요약',
  'results.pillarReviews': '원칙별 검토',
  'results.recommendations': '권장사항',
  'results.downloadReport': '리포트 다운로드',
  'results.requestModification': '수정 요청',

  // Agent Config Page
  'agentConfig.title': '아키텍처 리뷰 에이전트 설정',
  'agentConfig.architectureAnalysis': '아키텍처 분석',
  'agentConfig.visionModel': 'Vision 모델',
  'agentConfig.maxTokens': 'Max Tokens',
  'agentConfig.temperature': 'Temperature',
  'agentConfig.analysisPrompt': '분석 프롬프트',
  'agentConfig.save': '저장',
  'agentConfig.resetDefault': '기본값으로 초기화',
  'agentConfig.saved': '설정이 저장되었습니다',
  'agentConfig.note': '설정 변경 사항은 다음 검토부터 적용됩니다.',
  'agentConfig.pillarEnabled': '활성',
  'agentConfig.pillarDisabled': '비활성',

  // Pillars
  'pillar.operationalExcellence': '운영 우수성',
  'pillar.security': '보안',
  'pillar.reliability': '안정성',
  'pillar.performanceEfficiency': '성능 효율성',
  'pillar.costOptimization': '비용 최적화',
  'pillar.sustainability': '지속 가능성',

  // Dashboard
  'dashboard.title': '대시보드',
  'dashboard.totalReviews': '총 검토 수',
  'dashboard.pendingReviews': '대기 중',
  'dashboard.completedReviews': '완료',
  'dashboard.averageScore': '평균 점수',

  // Policy Management
  'policy.title': '거버넌스 정책 관리',
  'policy.addPolicy': '정책 추가',
  'policy.editPolicy': '정책 편집',
  'policy.deletePolicy': '정책 삭제',
  'policy.policyName': '정책 이름',
  'policy.policyDescription': '정책 설명',
  'policy.policyRules': '정책 규칙',

  // Status
  'status.pending': '대기 중',
  'status.inProgress': '진행 중',
  'status.completed': '완료',
  'status.failed': '실패',
  'status.reviewCompleted': '검토 완료',
  'status.pendingReview': '검토 대기 중',
  'status.inReview': '검토 중',
  'status.modificationRequired': '수정 필요',
  'status.rejected': '반려됨',

  // Upload Page Extended
  'upload.fileSelect': '파일을 선택하거나 드래그하세요',
  'upload.supportedFormatsExt': '지원 형식: PDF, PNG, JPG (최대 100MB)',
  'upload.pptWarning': '⚠️ PPT 파일은 지원하지 않습니다. PDF로 변환하여 업로드해주세요.',
  'upload.documentTitle': '문서 제목',
  'upload.documentDescription': '문서 설명',
  'upload.documentFormat': '문서 형식',
  'upload.reviewerEmail': '검토자 이메일',
  'upload.reviewerEmailHelper': '검토를 요청할 CCoE 팀원의 이메일 주소',
  'upload.requestReview': '검토 요청하기',
  'upload.uploading': '업로드 중...',
  'upload.successMessage': '문서가 성공적으로 업로드되었습니다. 검토자에게 알림이 발송되었습니다.',
  'upload.imageFormat': '이미지 (PNG/JPG)',

  // My Requests Page
  'myRequests.pageTitle': '아키텍처 리뷰 요청 목록',
  'myRequests.documentTitle': '문서 제목',
  'myRequests.reviewer': '검토자',
  'myRequests.version': '버전',
  'myRequests.update': '업데이트',
  'myRequests.actions': '작업',
  'myRequests.rejectionReason': '반려 사유',
  'myRequests.documentPreview': '문서 미리보기',
  'myRequests.viewResults': '검토 결과 보기',
  'myRequests.downloadReport': '리포트 다운로드',
  'myRequests.deleteTooltip': '삭제',
  'myRequests.cannotDeleteInReview': '검토 중일 때는 삭제 불가',
  'myRequests.cannotDeleteCompleted': '검토 완료된 항목은 삭제 불가',
  'myRequests.noRequestsMessage': '아직 검토 요청이 없습니다. 문서를 업로드하여 검토를 요청하세요.',
  'myRequests.uploadDocument': '문서 업로드하기',
  'myRequests.deleteTitle': '검토 요청 삭제',
  'myRequests.deleteConfirm': '를 삭제하시겠습니까?',
  'myRequests.deleteWarning': '업로드된 문서와 관련 데이터가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
  'myRequests.deleting': '삭제 중...',

  // History Page
  'history.pageTitle': '아키텍처 리뷰 히스토리',
  'history.submitter': '제출자',
  'history.documentVersion': '문서 버전',
  'history.reviewCount': '검토 횟수',
  'history.lastReviewDate': '최종 검토일',
  'history.reviewHistory': '검토 이력',
  'history.reviewNumber': '검토 번호',
  'history.startTime': '시작 시간',
  'history.completionTime': '완료 시간',
  'history.selectedPillars': '선택된 Pillar',
  'history.noHistory': '검토 이력이 없습니다.',
  'history.noSearchResults': '검색 결과가 없습니다.',
  'history.searchPlaceholder': '문서 제목 또는 제출자',
  'history.statusFilter': '상태 필터',
  'history.all': '전체',
  'history.viewResults': '결과 보기',
  'history.download': '다운로드',
  'history.deleteCannotUndo': '이 작업은 되돌릴 수 없습니다.',

  // Dashboard Page
  'dashboard.pageTitle': '아키텍처 리뷰 대시보드',
  'dashboard.searchPlaceholder': '문서 제목, 제출자, 요청 ID',
  'dashboard.totalRequests': '전체 검토 요청',
  'dashboard.filtered': '필터링',
  'dashboard.waiting': '대기 중',
  'dashboard.reviewing': '검토 중',
  'dashboard.completed': '완료',
  'dashboard.submitter': '제출자',
  'dashboard.documentVersion': '문서 버전',
  'dashboard.reviewCount': '검토 횟수',
  'dashboard.requestDate': '요청일',
  'dashboard.lastReview': '최근 검토',
  'dashboard.id': 'ID',
  'dashboard.documentPreview': '문서 미리보기',
  'dashboard.viewDetails': '상세보기',
  'dashboard.reject': '반려',
  'dashboard.reReview': '재검토',
  'dashboard.startReview': '검토 시작',
  'dashboard.rejectTitle': '검토 요청 반려',
  'dashboard.rejectDescription': '반려 사유를 입력해주세요. 이 내용은 요청자에게 전달됩니다.',
  'dashboard.rejectReason': '반려 사유',
  'dashboard.rejectPlaceholder': '예: 아키텍처 설계가 불충분합니다. 보안 요구사항을 추가해주세요.',
  'dashboard.rejectConfirm': '반려 확정',
  'dashboard.processing': '처리 중...',
  'dashboard.noResults': '검색 결과가 없습니다.',
  'dashboard.noPendingRequests': '현재 대기 중인 검토 요청이 없습니다.',

  // Policy Management Page
  'policy.pageTitle': '거버넌스 정책 관리',
  'policy.uploadPolicy': '정책 업로드',
  'policy.policyTitle': '정책 제목',
  'policy.fileName': '파일명',
  'policy.uploadedBy': '업로드자',
  'policy.uploadedAt': '업로드일',
  'policy.deleteConfirm': '이 정책을 삭제하시겠습니까?',
  'policy.uploadSuccess': '정책이 성공적으로 업로드되었습니다.',
  'policy.deleteSuccess': '정책이 삭제되었습니다.',
  'policy.noPolicies': '등록된 거버넌스 정책이 없습니다.',
  'policy.uploadDialogTitle': '거버넌스 정책 업로드',
  'policy.selectFile': '파일 선택',

  // Review Execute Page
  'execute.pageTitle': '아키텍처 검토 실행',
  'execute.documentInfo': '문서 정보',
  'execute.documentTitle': '문서 제목',
  'execute.reviewRequestId': '검토 요청 ID',
  'execute.pillarSelection': '원칙 선택',
  'execute.pillarSelectionDesc': '검토할 아키텍처 모범사례의 원칙을 선택하세요 (최소 1개)',
  'execute.additionalInstructions': '추가 지시사항 (선택사항)',
  'execute.instructionPlaceholder': '에 대한 추가 검토 지시사항을 입력하세요',
  'execute.architecturePages': '📄 아키텍처 다이어그램 페이지 (선택사항)',
  'execute.architecturePagesDesc': '아키텍처 다이어그램이 있는 페이지 번호를 입력하세요',
  'execute.architecturePagesPlaceholder': '예: 15, 18, 20',
  'execute.architecturePagesHelper': '여러 페이지는 쉼표로 구분. 비워두면 AI가 자동으로 찾습니다',
  'execute.architecturePagesTip': '💡 대시보드에서 문서 미리보기를 통해 페이지 번호를 확인할 수 있습니다',
  'execute.governancePolicies': '거버넌스 정책 (선택사항)',
  'execute.governancePoliciesDesc': '적용할 거버넌스 정책을 선택하세요',
  'execute.noPolicies': '등록된 거버넌스 정책이 없습니다. 거버넌스 메뉴에서 정책을 등록하세요.',
  'execute.policiesSelected': '개의 거버넌스 정책이 선택되었습니다.',
  'execute.reviewInProgress': '검토 진행 중...',
  'execute.reviewInProgressDesc': '검토가 진행 중입니다. 완료되면 결과 페이지로 이동합니다.',
  'execute.executeReview': '검토 실행',
  'execute.executing': '검토 실행 중...',
  'execute.pillarsCount': '개 원칙',
  'execute.disabled': '비활성',
  'execute.loading': '로딩 중...',

  // Review Results Page
  'results.pageTitle': '검토 결과',
  'results.summaryTab': '종합 요약',
  'results.architectureTab': '아키텍처 다이어그램 분석',
  'results.pillarTab': '아키텍처 영역별 분석',
  'results.reviewSummary': '검토 요약',
  'results.reviewCompleted': '검토 완료',
  'results.areas': '영역',
  'results.improvements': '개선 권장',
  'results.recommendations': '개 권장사항',
  'results.policyViolations': '정책 위반',
  'results.violations': '개 위반사항',
  'results.priorityImprovements': '우선순위별 개선 제안',
  'results.highPriority': '🔴 High Priority (즉시 조치)',
  'results.mediumPriority': '🟡 Medium Priority (단기 계획)',
  'results.lowPriority': '🟢 Low Priority (장기 개선)',
  'results.lowPriorityDesc': '나머지 권장사항은 "아키텍처 영역별 분석" 탭에서 확인하세요.',
  'results.architectureAnalysis': '🏗️ 아키텍처 다이어그램 종합 분석',
  'results.parsingFailed': '문서 파싱에 실패하여 메타데이터만 사용하여 검토를 수행했습니다.',
  'results.keyFindings': '📋 주요 발견사항',
  'results.recommendationsTitle': '💡 권장사항',
  'results.governanceViolations': '⚠️ 거버넌스 정책 위반',
  'results.recommendedAction': '권장 조치',
  'results.reviewCompletedAt': '검토 완료',
  'results.noResults': '검토 결과가 없습니다.',
  'results.iacGeneration': 'IaC 생성',
  'results.preparing': '준비 중',

  // Cost Analysis Tab
  'cost.tabTitle': '비용 분석',

  // Governance Compliance Tab
  'governance.tabTitle': '거버넌스 준수',
  'governance.title': '📋 거버넌스 정책 준수 분석',
  'governance.noData': '거버넌스 준수 분석 데이터가 없습니다. 활성화된 거버넌스 정책이 없거나 이전 검토에서는 지원되지 않습니다.',
  'governance.compliant': '준수',
  'governance.nonCompliant': '미준수',
  'governance.partiallyCompliant': '부분 준수',
  'governance.notApplicable': '해당 없음',
  'governance.violationsFound': '위반 사항',
  'governance.recommendation': '권장 조치',
  'governance.recommendations': '권장사항',

  // Policy Management - additional
  'policy.status': '상태',
  'policy.active': '활성',
  'policy.inactive': '비활성',
  'policy.activateSuccess': '정책이 활성화되었습니다.',
  'policy.deactivateSuccess': '정책이 비활성화되었습니다.',
  'cost.title': '💰 검토 비용 분석',
  'cost.totalCost': '총 비용',
  'cost.serviceSummary': '서비스별 비용 요약',
  'cost.detailTitle': '상세 비용 내역',
  'cost.service': '서비스',
  'cost.operation': '작업',
  'cost.model': '모델',
  'cost.inputTokens': '입력 토큰',
  'cost.outputTokens': '출력 토큰',
  'cost.images': '이미지',
  'cost.unitCost': '비용 (USD)',
  'cost.bedrock': 'Amazon Bedrock',
  'cost.s3': 'Amazon S3',
  'cost.dynamodb': 'Amazon DynamoDB',
  'cost.lambda': 'AWS Lambda',
  'cost.other': '기타',
  'cost.noData': '비용 데이터가 없습니다. 이전 검토에서는 비용 추적이 지원되지 않습니다.',
  'cost.disclaimer': '※ 비용은 us-east-1 리전 온디맨드 요금 기준 추정치입니다. 실제 청구 금액과 다를 수 있습니다.',

  // Errors
  'error.networkError': '네트워크 오류가 발생했습니다',
  'error.serverError': '서버 오류가 발생했습니다',
  'error.unauthorized': '인증이 필요합니다',
  'error.forbidden': '접근 권한이 없습니다',
  'error.notFound': '요청한 리소스를 찾을 수 없습니다',
};

// English translations
const en: Record<string, string> = {
  // Common
  'common.appName': 'AWS Architecture Review',
  'common.loading': 'Loading...',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.submit': 'Submit',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.close': 'Close',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.reset': 'Reset',
  'common.confirm': 'Confirm',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.warning': 'Warning',
  'common.info': 'Info',
  'common.requester': 'Requester',
  'common.reviewer': 'Reviewer',

  // Navigation
  'nav.home': 'Home',
  'nav.upload': 'Upload Document',
  'nav.myRequests': 'My Requests',
  'nav.history': 'Review History',
  'nav.dashboard': 'Dashboard',
  'nav.agentConfig': 'Agent Config',
  'nav.policyManagement': 'Governance Policy',
  'nav.logout': 'Logout',

  // Login Page
  'login.title': 'Login',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Login',
  'login.error': 'Login failed',
  'login.welcome': 'Welcome to AWS Architecture Review System',

  // Home Page
  'home.title': 'AWS Architecture Review',
  'home.subtitle': 'AI-Powered Architecture Review System',
  'home.description': 'Automatically review your architecture based on AWS Well-Architected Framework.',
  'home.startReview': 'Start Review',
  'home.viewHistory': 'View History',
  'home.features.upload': 'Upload Document',
  'home.features.uploadDesc': 'Upload your architecture document in PDF format',
  'home.features.review': 'AI Review',
  'home.features.reviewDesc': 'Automatic review based on 6 Well-Architected pillars',
  'home.features.report': 'Generate Report',
  'home.features.reportDesc': 'Get detailed review results and recommendations',

  // Upload Page
  'upload.title': 'Upload Architecture Document',
  'upload.dragDrop': 'Drag and drop file here or click to upload',
  'upload.selectFile': 'Select File',
  'upload.supportedFormats': 'Supported formats: PDF',
  'upload.maxSize': 'Maximum file size: 10MB',
  'upload.documentName': 'Document Name',
  'upload.description': 'Description (optional)',
  'upload.architecturePages': 'Architecture Diagram Pages',
  'upload.architecturePagesHint': 'Enter page numbers containing architecture diagrams (e.g., 3, 5, 7)',
  'upload.submit': 'Upload and Request Review',
  'upload.success': 'Document uploaded successfully',
  'upload.error': 'Upload failed',

  // My Requests Page
  'myRequests.title': 'My Review Requests',
  'myRequests.noRequests': 'No review requests',
  'myRequests.status': 'Status',
  'myRequests.createdAt': 'Created At',
  'myRequests.viewDetails': 'View Details',

  // History Page
  'history.title': 'Review History',
  'history.noHistory': 'No review history',
  'history.documentName': 'Document Name',
  'history.reviewer': 'Reviewer',
  'history.completedAt': 'Completed At',
  'history.score': 'Score',

  // Review Results Page
  'results.title': 'Review Results',
  'results.summary': 'Summary',
  'results.pillarReviews': 'Pillar Reviews',
  'results.recommendations': 'Recommendations',
  'results.downloadReport': 'Download Report',
  'results.requestModification': 'Request Modification',

  // Agent Config Page
  'agentConfig.title': 'Architecture Review Agent Configuration',
  'agentConfig.architectureAnalysis': 'Architecture Analysis',
  'agentConfig.visionModel': 'Vision Model',
  'agentConfig.maxTokens': 'Max Tokens',
  'agentConfig.temperature': 'Temperature',
  'agentConfig.analysisPrompt': 'Analysis Prompt',
  'agentConfig.save': 'Save',
  'agentConfig.resetDefault': 'Reset to Default',
  'agentConfig.saved': 'Settings saved successfully',
  'agentConfig.note': 'Changes will be applied from the next review.',
  'agentConfig.pillarEnabled': 'Enabled',
  'agentConfig.pillarDisabled': 'Disabled',

  // Pillars
  'pillar.operationalExcellence': 'Operational Excellence',
  'pillar.security': 'Security',
  'pillar.reliability': 'Reliability',
  'pillar.performanceEfficiency': 'Performance Efficiency',
  'pillar.costOptimization': 'Cost Optimization',
  'pillar.sustainability': 'Sustainability',

  // Dashboard
  'dashboard.title': 'Dashboard',
  'dashboard.totalReviews': 'Total Reviews',
  'dashboard.pendingReviews': 'Pending',
  'dashboard.completedReviews': 'Completed',
  'dashboard.averageScore': 'Average Score',

  // Policy Management
  'policy.title': 'Governance Policy Management',
  'policy.addPolicy': 'Add Policy',
  'policy.editPolicy': 'Edit Policy',
  'policy.deletePolicy': 'Delete Policy',
  'policy.policyName': 'Policy Name',
  'policy.policyDescription': 'Policy Description',
  'policy.policyRules': 'Policy Rules',

  // Status
  'status.pending': 'Pending',
  'status.inProgress': 'In Progress',
  'status.completed': 'Completed',
  'status.failed': 'Failed',
  'status.reviewCompleted': 'Review Completed',
  'status.pendingReview': 'Pending Review',
  'status.inReview': 'In Review',
  'status.modificationRequired': 'Modification Required',
  'status.rejected': 'Rejected',

  // Upload Page Extended
  'upload.fileSelect': 'Select or drag a file here',
  'upload.supportedFormatsExt': 'Supported formats: PDF, PNG, JPG (Max 100MB)',
  'upload.pptWarning': '⚠️ PPT files are not supported. Please convert to PDF and upload.',
  'upload.documentTitle': 'Document Title',
  'upload.documentDescription': 'Document Description',
  'upload.documentFormat': 'Document Format',
  'upload.reviewerEmail': 'Reviewer Email',
  'upload.reviewerEmailHelper': 'Email address of the CCoE team member to request review',
  'upload.requestReview': 'Request Review',
  'upload.uploading': 'Uploading...',
  'upload.successMessage': 'Document uploaded successfully. Notification sent to reviewer.',
  'upload.imageFormat': 'Image (PNG/JPG)',

  // My Requests Page
  'myRequests.pageTitle': 'Architecture Review Requests',
  'myRequests.documentTitle': 'Document Title',
  'myRequests.reviewer': 'Reviewer',
  'myRequests.version': 'Version',
  'myRequests.update': 'Updated',
  'myRequests.actions': 'Actions',
  'myRequests.rejectionReason': 'Rejection Reason',
  'myRequests.documentPreview': 'Document Preview',
  'myRequests.viewResults': 'View Results',
  'myRequests.downloadReport': 'Download Report',
  'myRequests.deleteTooltip': 'Delete',
  'myRequests.cannotDeleteInReview': 'Cannot delete while in review',
  'myRequests.cannotDeleteCompleted': 'Cannot delete completed items',
  'myRequests.noRequestsMessage': 'No review requests yet. Upload a document to request a review.',
  'myRequests.uploadDocument': 'Upload Document',
  'myRequests.deleteTitle': 'Delete Review Request',
  'myRequests.deleteConfirm': 'Do you want to delete',
  'myRequests.deleteWarning': 'All uploaded documents and related data will be deleted. This action cannot be undone.',
  'myRequests.deleting': 'Deleting...',

  // History Page
  'history.pageTitle': 'Architecture Review History',
  'history.submitter': 'Submitter',
  'history.documentVersion': 'Doc Version',
  'history.reviewCount': 'Review Count',
  'history.lastReviewDate': 'Last Review',
  'history.reviewHistory': 'Review History',
  'history.reviewNumber': 'Review #',
  'history.startTime': 'Start Time',
  'history.completionTime': 'Completion Time',
  'history.selectedPillars': 'Selected Pillars',
  'history.noHistory': 'No review history.',
  'history.noSearchResults': 'No search results.',
  'history.searchPlaceholder': 'Document title or submitter',
  'history.statusFilter': 'Status Filter',
  'history.all': 'All',
  'history.viewResults': 'View Results',
  'history.download': 'Download',
  'history.deleteCannotUndo': 'This action cannot be undone.',

  // Dashboard Page
  'dashboard.pageTitle': 'Architecture Review Dashboard',
  'dashboard.searchPlaceholder': 'Document title, submitter, request ID',
  'dashboard.totalRequests': 'Total Review Requests',
  'dashboard.filtered': 'Filtered',
  'dashboard.waiting': 'Waiting',
  'dashboard.reviewing': 'Reviewing',
  'dashboard.completed': 'Completed',
  'dashboard.submitter': 'Submitter',
  'dashboard.documentVersion': 'Doc Version',
  'dashboard.reviewCount': 'Review Count',
  'dashboard.requestDate': 'Request Date',
  'dashboard.lastReview': 'Last Review',
  'dashboard.id': 'ID',
  'dashboard.documentPreview': 'Document Preview',
  'dashboard.viewDetails': 'View Details',
  'dashboard.reject': 'Reject',
  'dashboard.reReview': 'Re-review',
  'dashboard.startReview': 'Start Review',
  'dashboard.rejectTitle': 'Reject Review Request',
  'dashboard.rejectDescription': 'Please enter the reason for rejection. This will be sent to the requester.',
  'dashboard.rejectReason': 'Rejection Reason',
  'dashboard.rejectPlaceholder': 'e.g., Architecture design is insufficient. Please add security requirements.',
  'dashboard.rejectConfirm': 'Confirm Rejection',
  'dashboard.processing': 'Processing...',
  'dashboard.noResults': 'No search results.',
  'dashboard.noPendingRequests': 'No pending review requests.',

  // Policy Management Page
  'policy.pageTitle': 'Governance Policy Management',
  'policy.uploadPolicy': 'Upload Policy',
  'policy.policyTitle': 'Policy Title',
  'policy.fileName': 'File Name',
  'policy.uploadedBy': 'Uploaded By',
  'policy.uploadedAt': 'Uploaded At',
  'policy.deleteConfirm': 'Do you want to delete this policy?',
  'policy.uploadSuccess': 'Policy uploaded successfully.',
  'policy.deleteSuccess': 'Policy deleted.',
  'policy.noPolicies': 'No governance policies registered.',
  'policy.uploadDialogTitle': 'Upload Governance Policy',
  'policy.selectFile': 'Select File',

  // Review Execute Page
  'execute.pageTitle': 'Execute Architecture Review',
  'execute.documentInfo': 'Document Information',
  'execute.documentTitle': 'Document Title',
  'execute.reviewRequestId': 'Review Request ID',
  'execute.pillarSelection': 'Pillar Selection',
  'execute.pillarSelectionDesc': 'Select architecture best practice pillars to review (minimum 1)',
  'execute.additionalInstructions': 'Additional Instructions (Optional)',
  'execute.instructionPlaceholder': 'Enter additional review instructions for',
  'execute.architecturePages': '📄 Architecture Diagram Pages (Optional)',
  'execute.architecturePagesDesc': 'Enter page numbers containing architecture diagrams',
  'execute.architecturePagesPlaceholder': 'e.g., 15, 18, 20',
  'execute.architecturePagesHelper': 'Separate multiple pages with commas. Leave empty for AI auto-detection',
  'execute.architecturePagesTip': '💡 You can check page numbers via document preview in the dashboard',
  'execute.governancePolicies': 'Governance Policies (Optional)',
  'execute.governancePoliciesDesc': 'Select governance policies to apply',
  'execute.noPolicies': 'No governance policies registered. Register policies in the Governance menu.',
  'execute.policiesSelected': 'governance policies selected.',
  'execute.reviewInProgress': 'Review in Progress...',
  'execute.reviewInProgressDesc': 'Review is in progress. You will be redirected to results when complete.',
  'execute.executeReview': 'Execute Review',
  'execute.executing': 'Executing Review...',
  'execute.pillarsCount': 'pillars',
  'execute.disabled': 'Disabled',
  'execute.loading': 'Loading...',

  // Review Results Page
  'results.pageTitle': 'Review Results',
  'results.summaryTab': 'Summary',
  'results.architectureTab': 'Architecture Diagram Analysis',
  'results.pillarTab': 'Pillar Analysis',
  'results.reviewSummary': 'Review Summary',
  'results.reviewCompleted': 'Review Completed',
  'results.areas': 'areas',
  'results.improvements': 'Improvements',
  'results.recommendations': 'recommendations',
  'results.policyViolations': 'Policy Violations',
  'results.violations': 'violations',
  'results.priorityImprovements': 'Priority Improvements',
  'results.highPriority': '🔴 High Priority (Immediate Action)',
  'results.mediumPriority': '🟡 Medium Priority (Short-term Plan)',
  'results.lowPriority': '🟢 Low Priority (Long-term Improvement)',
  'results.lowPriorityDesc': 'See remaining recommendations in the "Pillar Analysis" tab.',
  'results.architectureAnalysis': '🏗️ Architecture Diagram Analysis',
  'results.parsingFailed': 'Document parsing failed. Review was performed using metadata only.',
  'results.keyFindings': '📋 Key Findings',
  'results.recommendationsTitle': '💡 Recommendations',
  'results.governanceViolations': '⚠️ Governance Policy Violations',
  'results.recommendedAction': 'Recommended Action',
  'results.reviewCompletedAt': 'Review Completed',
  'results.noResults': 'No review results.',
  'results.iacGeneration': 'Generate IaC',
  'results.preparing': 'Preparing',

  // Cost Analysis Tab
  'cost.tabTitle': 'Cost Analysis',

  // Governance Compliance Tab
  'governance.tabTitle': 'Governance Compliance',
  'governance.title': '📋 Governance Policy Compliance Analysis',
  'governance.noData': 'No governance compliance data available. No active governance policies or not supported for previous reviews.',
  'governance.compliant': 'Compliant',
  'governance.nonCompliant': 'Non-Compliant',
  'governance.partiallyCompliant': 'Partially Compliant',
  'governance.notApplicable': 'Not Applicable',
  'governance.violationsFound': 'Violations Found',
  'governance.recommendation': 'Recommended Action',
  'governance.recommendations': 'Recommendations',

  // Policy Management - additional
  'policy.status': 'Status',
  'policy.active': 'Active',
  'policy.inactive': 'Inactive',
  'policy.activateSuccess': 'Policy activated.',
  'policy.deactivateSuccess': 'Policy deactivated.',
  'cost.title': '💰 Review Cost Analysis',
  'cost.totalCost': 'Total Cost',
  'cost.serviceSummary': 'Cost Summary by Service',
  'cost.detailTitle': 'Detailed Cost Breakdown',
  'cost.service': 'Service',
  'cost.operation': 'Operation',
  'cost.model': 'Model',
  'cost.inputTokens': 'Input Tokens',
  'cost.outputTokens': 'Output Tokens',
  'cost.images': 'Images',
  'cost.unitCost': 'Cost (USD)',
  'cost.bedrock': 'Amazon Bedrock',
  'cost.s3': 'Amazon S3',
  'cost.dynamodb': 'Amazon DynamoDB',
  'cost.lambda': 'AWS Lambda',
  'cost.other': 'Other',
  'cost.noData': 'No cost data available. Cost tracking is not supported for previous reviews.',
  'cost.disclaimer': '※ Costs are estimates based on us-east-1 region on-demand pricing. Actual charges may differ.',

  // Errors
  'error.networkError': 'Network error occurred',
  'error.serverError': 'Server error occurred',
  'error.unauthorized': 'Authentication required',
  'error.forbidden': 'Access denied',
  'error.notFound': 'Resource not found',
};

const translations: Record<Language, Record<string, string>> = { ko, en };

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'ko';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
