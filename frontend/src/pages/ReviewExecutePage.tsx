import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Checkbox,
  TextField,
  Button,
  Chip,
  Alert,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import { PillarName } from '../types';
import { api } from '../services/api';

const PILLARS: PillarName[] = [
  'Operational Excellence',
  'Security',
  'Reliability',
  'Performance Efficiency',
  'Cost Optimization',
  'Sustainability',
];

const PILLAR_LABELS: Record<PillarName, string> = {
  'Operational Excellence': '운영 우수성',
  'Security': '보안',
  'Reliability': '안정성',
  'Performance Efficiency': '성능 효율성',
  'Cost Optimization': '비용 최적화',
  'Sustainability': '지속 가능성',
};

export function ReviewExecutePage() {
  const { id: reviewRequestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedPillars, setSelectedPillars] = useState<Set<PillarName>>(new Set(PILLARS));
  const [pillarConfigs, setPillarConfigs] = useState<Record<PillarName, { enabled: boolean }>>({} as any);
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const [selectedPolicies, setSelectedPolicies] = useState<Set<string>>(new Set());
  const [governancePolicies, setGovernancePolicies] = useState<any[]>([]);
  const [architecturePages, setArchitecturePages] = useState('');
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [error, setError] = useState('');
  const [documentTitle, setDocumentTitle] = useState(location.state?.documentTitle || '');
  const [reviewRequest, setReviewRequest] = useState<any>(null);

  useEffect(() => {
    loadPillarConfigs();
    loadReviewRequest();
    loadGovernancePolicies();
  }, []);

  const loadReviewRequest = async () => {
    if (!reviewRequestId) return;
    
    try {
      const result = await api.getReviewRequest(reviewRequestId);
      setReviewRequest(result.reviewRequest);
      setDocumentTitle(result.reviewRequest.documentTitle || result.reviewRequest.documentId);
    } catch (err: any) {
      console.warn('Failed to load review request:', err);
      // documentTitle이 state로 전달된 경우 계속 진행
    }
  };

  const loadGovernancePolicies = async () => {
    try {
      setLoadingPolicies(true);
      const result = await api.getGovernancePolicies();
      setGovernancePolicies(result.policies || []);
    } catch (err: any) {
      console.warn('Failed to load governance policies:', err);
      setGovernancePolicies([]);
    } finally {
      setLoadingPolicies(false);
    }
  };

  const loadPillarConfigs = async () => {
    try {
      setLoading(true);
      const result = await api.getPillars();
      const configMap: Record<PillarName, { enabled: boolean }> = {} as any;
      
      result.pillars.forEach(config => {
        configMap[config.pillarName] = { enabled: config.enabled };
      });
      
      setPillarConfigs(configMap);
      
      // Initialize selected pillars with only enabled ones
      const enabledPillars = new Set<PillarName>();
      result.pillars.forEach(config => {
        if (config.enabled) {
          enabledPillars.add(config.pillarName);
        }
      });
      setSelectedPillars(enabledPillars);
    } catch (err: any) {
      console.warn('Failed to load pillar configs, using defaults');
      // Default: all enabled
      const defaultConfigs: Record<PillarName, { enabled: boolean }> = {} as any;
      PILLARS.forEach(pillar => {
        defaultConfigs[pillar] = { enabled: true };
      });
      setPillarConfigs(defaultConfigs);
    } finally {
      setLoading(false);
    }
  };

  const handlePillarToggle = (pillar: PillarName) => {
    const newSelected = new Set(selectedPillars);
    if (newSelected.has(pillar)) {
      newSelected.delete(pillar);
    } else {
      newSelected.add(pillar);
    }
    setSelectedPillars(newSelected);
  };

  const handleInstructionChange = (pillar: PillarName, value: string) => {
    setInstructions(prev => ({ ...prev, [pillar]: value }));
  };

  const handlePolicyToggle = (policyId: string) => {
    const newSelected = new Set(selectedPolicies);
    if (newSelected.has(policyId)) {
      newSelected.delete(policyId);
    } else {
      newSelected.add(policyId);
    }
    setSelectedPolicies(newSelected);
  };

  const handleExecute = async () => {
    if (!reviewRequestId) return;

    try {
      setExecuting(true);
      setError('');

      const pillarSelection = Array.from(selectedPillars);
      console.log('Executing review with pillars:', pillarSelection);
      console.log('Total pillars selected:', pillarSelection.length);

      // Parse architecture pages
      const pageNumbers = architecturePages
        .split(',')
        .map(p => parseInt(p.trim()))
        .filter(p => !isNaN(p) && p > 0);
      
      if (pageNumbers.length > 0) {
        console.log('User-specified architecture pages:', pageNumbers);
      }

      // 재검토인 경우 상태를 "In Review"로 변경
      if (reviewRequest?.status === 'Review Completed') {
        console.log('Re-review detected, updating status to "In Review"');
        try {
          await api.updateReviewRequestStatus(reviewRequestId, {
            status: 'In Review',
            comment: '재검토 시작',
          });
        } catch (statusError) {
          console.warn('Failed to update status for re-review:', statusError);
          // 상태 업데이트 실패해도 검토는 계속 진행
        }
      }

      const result = await api.executeReview({
        reviewRequestId,
        pillarSelection,
        governancePolicies: Array.from(selectedPolicies),
        architecturePages: pageNumbers.length > 0 ? pageNumbers : undefined,
        instructions,
      });

      console.log('Review execution started:', result.executionId);

      // Poll for status and navigate when ready
      pollExecutionStatus(result.executionId);
    } catch (err: any) {
      console.error('Execute review error:', err);
      
      let errorMessage = '검토 실행에 실패했습니다';
      
      if (err.code === 'ERR_NETWORK') {
        errorMessage = 'CORS 에러: API 서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.';
      } else if (err.response?.status === 504) {
        errorMessage = 'Gateway Timeout: 요청 처리 시간이 초과되었습니다. 잠시 후 다시 시도하세요.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setExecuting(false);
    }
  };

  const pollExecutionStatus = async (executionId: string) => {
    const maxAttempts = 60; // 5 minutes (5 seconds * 60)
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await api.getReviewStatus(executionId);
        
        if (status.status === 'Completed') {
          console.log('Review completed, navigating to results');
          navigate(`/reviews/${executionId}/results`);
          return;
        }
        
        if (status.status === 'Failed') {
          setError('검토 실행이 실패했습니다');
          setExecuting(false);
          return;
        }

        // Still in progress
        attempts++;
        if (attempts >= maxAttempts) {
          setError('검토 실행 시간이 초과되었습니다');
          setExecuting(false);
          return;
        }

        // Poll again after 5 seconds
        setTimeout(poll, 5000);
      } catch (err: any) {
        console.error('Status polling error:', err);
        setError('상태 확인 중 오류가 발생했습니다');
        setExecuting(false);
      }
    };

    // Start polling
    setTimeout(poll, 2000); // Wait 2 seconds before first poll
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700} sx={{ mb: 3 }}>
        아키텍처 검토 실행
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          문서 정보
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          <strong>문서 제목:</strong> {documentTitle || '로딩 중...'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>검토 요청 ID:</strong> {reviewRequestId}
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          원칙 선택
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          검토할 아키텍처 모범사례의 원칙을 선택하세요 (최소 1개)
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Box>
            {PILLARS.map((pillar) => {
              const isEnabled = pillarConfigs[pillar]?.enabled !== false;
              const isSelected = selectedPillars.has(pillar);
              
              return (
                <Paper 
                  key={pillar} 
                  variant="outlined" 
                  sx={{ 
                    mb: 2, 
                    p: 2,
                    bgcolor: isSelected ? 'action.selected' : 'background.paper',
                    opacity: !isEnabled ? 0.6 : 1,
                    border: isSelected ? '2px solid' : '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handlePillarToggle(pillar)}
                      disabled={executing || !isEnabled}
                      sx={{ p: 0, mt: 0.25 }}
                    />
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: isSelected ? 2 : 0 }}>
                        <Typography variant="body1" fontWeight={600}>
                          {PILLAR_LABELS[pillar]}
                        </Typography>
                        {!isEnabled && (
                          <Chip label="비활성" size="small" color="default" />
                        )}
                      </Box>

                      {isSelected && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, textAlign: 'left' }}>
                            추가 지시사항 (선택사항)
                          </Typography>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            placeholder={`${PILLAR_LABELS[pillar]}에 대한 추가 검토 지시사항을 입력하세요`}
                            value={instructions[pillar] || ''}
                            onChange={(e) => handleInstructionChange(pillar, e.target.value)}
                            size="small"
                            disabled={executing}
                            variant="outlined"
                          />
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          📄 아키텍처 다이어그램 페이지 (선택사항)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          아키텍처 다이어그램이 있는 페이지 번호를 입력하세요
        </Typography>
        <TextField
          fullWidth
          placeholder="예: 15, 18, 20"
          value={architecturePages}
          onChange={(e) => setArchitecturePages(e.target.value)}
          disabled={executing}
          helperText="여러 페이지는 쉼표로 구분. 비워두면 AI가 자동으로 찾습니다"
        />
        <Alert severity="info" sx={{ mt: 2 }}>
          💡 대시보드에서 문서 미리보기를 통해 페이지 번호를 확인할 수 있습니다
        </Alert>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          거버넌스 정책 (선택사항)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          적용할 거버넌스 정책을 선택하세요
        </Typography>
        
        {loadingPolicies ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : governancePolicies.length === 0 ? (
          <Alert severity="info">
            등록된 거버넌스 정책이 없습니다. 거버넌스 메뉴에서 정책을 등록하세요.
          </Alert>
        ) : (
          <Box>
            {governancePolicies.map((policy) => (
              <Paper
                key={policy.policyId}
                variant="outlined"
                sx={{
                  mb: 2,
                  p: 2,
                  bgcolor: selectedPolicies.has(policy.policyId) ? 'action.selected' : 'background.paper',
                  border: selectedPolicies.has(policy.policyId) ? '2px solid' : '1px solid',
                  borderColor: selectedPolicies.has(policy.policyId) ? 'primary.main' : 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Checkbox
                    checked={selectedPolicies.has(policy.policyId)}
                    onChange={() => handlePolicyToggle(policy.policyId)}
                    disabled={executing}
                    sx={{ p: 0, mt: 0.25 }}
                  />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1" fontWeight={600} gutterBottom>
                      {policy.title}
                    </Typography>
                    {policy.description && (
                      <Typography variant="body2" color="text.secondary">
                        {policy.description}
                      </Typography>
                    )}
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label={`${policy.fileName}`} 
                        size="small" 
                        variant="outlined"
                      />
                      <Chip 
                        label={new Date(policy.uploadedAt).toLocaleDateString('ko-KR')} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                </Box>
              </Paper>
            ))}
            
            {selectedPolicies.size > 0 && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {selectedPolicies.size}개의 거버넌스 정책이 선택되었습니다.
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {executing && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            검토 진행 중...
          </Typography>
          <LinearProgress sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary" align="center">
            검토가 진행 중입니다. 완료되면 결과 페이지로 이동합니다.
          </Typography>
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          color="secondary"
          size="large"
          onClick={handleExecute}
          disabled={selectedPillars.size === 0 || executing}
          fullWidth
        >
          {executing ? '검토 실행 중...' : `검토 실행 (${selectedPillars.size}개 원칙)`}
        </Button>
      </Box>
    </Box>
  );
}
