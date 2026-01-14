import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Paper, 
  Tabs, 
  Tab, 
  Button, 
  Divider, 
  Alert, 
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
} from '@mui/material';
import { 
  Download as DownloadIcon, 
  Code as CodeIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { PillarName, PillarResult } from '../types';
import { api } from '../services/api';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

const PILLAR_LABELS: Record<PillarName, string> = {
  'Operational Excellence': '운영 우수성',
  'Security': '보안',
  'Reliability': '안정성',
  'Performance Efficiency': '성능 효율성',
  'Cost Optimization': '비용 최적화',
  'Sustainability': '지속 가능성',
};

const PILLAR_ICONS: Record<PillarName, string> = {
  'Operational Excellence': '⚙️',
  'Security': '🔒',
  'Reliability': '🛡️',
  'Performance Efficiency': '⚡',
  'Cost Optimization': '💰',
  'Sustainability': '🌱',
};

export function ReviewResultsPage() {
  const { executionId } = useParams();
  const [mainTab, setMainTab] = useState(0); // 0: 종합요약, 1: 아키텍처, 2: Pillar
  const [pillarTab, setPillarTab] = useState(0); // Pillar 하위 탭
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<string, PillarResult>>({});
  const [overallSummary, setOverallSummary] = useState<string>(''); // 아키텍처 분석 탭용
  const [executiveSummary, setExecutiveSummary] = useState<string>(''); // 종합 요약 탭용
  const [downloading, setDownloading] = useState<'pdf' | 'word' | null>(null);

  useEffect(() => {
    loadResults();
  }, [executionId]);

  const loadResults = async () => {
    if (!executionId) return;
    try {
      setLoading(true);
      const response = await api.getReviewResults(executionId);
      console.log('API Response:', response);
      console.log('Executive Summary:', response.reviewReport.executiveSummary);
      setResults(response.reviewReport.pillarResults || {});
      setOverallSummary(response.reviewReport.overallSummary || '');
      setExecutiveSummary(response.reviewReport.executiveSummary || '');
    } catch (err: any) {
      setError(err.response?.data?.error || '검토 결과를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!executionId) return;
    
    try {
      setDownloading('pdf');
      const blob = await api.downloadPdfReport(executionId);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `architecture-review-${executionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'PDF 다운로드에 실패했습니다');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadWord = async () => {
    if (!executionId) return;
    
    try {
      setDownloading('word');
      const blob = await api.downloadWordReport(executionId);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `architecture-review-${executionId}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Word 다운로드에 실패했습니다');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const pillars = Object.keys(results) as PillarName[];
  
  if (pillars.length === 0) {
    return <Alert severity="info">검토 결과가 없습니다.</Alert>;
  }

  const currentPillar = pillars[pillarTab];
  const currentResult = results[currentPillar];

  // 종합 요약 탭
  const renderSummaryTab = () => {
    console.log('Rendering Summary Tab - executiveSummary:', executiveSummary);
    console.log('executiveSummary length:', executiveSummary?.length);
    
    return (
      <Box>
        {/* Executive Summary */}
        {executiveSummary ? (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ textAlign: 'left' }}>
              <MarkdownRenderer content={executiveSummary} />
            </Box>
          </Paper>
        ) : (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, textAlign: 'left' }}>
              검토 요약
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'left' }}>
              {pillars.length}개 아키텍처 영역에 대한 검토가 완료되었습니다.
              총 {pillars.reduce((sum, p) => sum + (results[p].recommendations?.length || 0), 0)}개의 개선 권장사항이 도출되었습니다.
            </Typography>
          </Paper>
        )}

        {/* 검토 결과 요약 카드 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', borderLeft: 4, borderColor: 'success.main' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CheckIcon sx={{ color: 'success.main', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                    검토 완료
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  {pillars.filter(p => !results[p].error).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  / {pillars.length} 영역
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', borderLeft: 4, borderColor: 'warning.main' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <WarningIcon sx={{ color: 'warning.main', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                    개선 권장
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  {pillars.reduce((sum, p) => sum + (results[p].recommendations?.length || 0), 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  개 권장사항
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', borderLeft: 4, borderColor: 'error.main' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ErrorIcon sx={{ color: 'error.main', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
                    정책 위반
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  {pillars.reduce((sum, p) => sum + (results[p].governanceViolations?.length || 0), 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  개 위반사항
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 우선순위별 개선 제안 */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, textAlign: 'left' }}>
            우선순위별 개선 제안
          </Typography>
          
          {/* High Priority */}
          {pillars.some(p => results[p].governanceViolations?.some(v => v.severity === 'High')) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main', mb: 2, textAlign: 'left' }}>
                🔴 High Priority (즉시 조치)
              </Typography>
              {pillars.map(pillar => 
                results[pillar].governanceViolations?.filter(v => v.severity === 'High').map((v, i) => (
                  <Alert key={`${pillar}-${i}`} severity="error" sx={{ mb: 1, textAlign: 'left' }}>
                    <Typography variant="body2" fontWeight="bold">
                      [{PILLAR_LABELS[pillar]}] {v.policyTitle}
                    </Typography>
                    <Typography variant="body2">{v.violationDescription}</Typography>
                  </Alert>
                ))
              )}
            </Box>
          )}

          {/* Medium Priority */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main', mb: 2, textAlign: 'left' }}>
              🟡 Medium Priority (단기 계획)
            </Typography>
            {pillars.slice(0, 3).map(pillar => 
              results[pillar].recommendations?.slice(0, 2).map((rec, i) => {
                const titleMatch = rec.match(/^\*\*(.+?)\*\*/);
                const title = titleMatch ? titleMatch[1] : `권장사항 ${i + 1}`;
                return (
                  <Paper key={`${pillar}-${i}`} sx={{ p: 2, mb: 1, bgcolor: 'warning.50', textAlign: 'left' }}>
                    <Typography variant="body2" fontWeight="bold">
                      [{PILLAR_LABELS[pillar]}] {title}
                    </Typography>
                  </Paper>
                );
              })
            )}
          </Box>

          {/* Low Priority */}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main', mb: 2, textAlign: 'left' }}>
              🟢 Low Priority (장기 개선)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
              나머지 권장사항은 "아키텍처 영역별 분석" 탭에서 확인하세요.
            </Typography>
          </Box>
        </Paper>
      </Box>
    );
  };

  // 아키텍처 분석 탭
  const renderArchitectureTab = () => (
    <Box>
      <Paper sx={{ p: 3, bgcolor: 'info.50', borderLeft: 4, borderColor: 'info.main' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: 'info.main' }}>
          🏗️ 아키텍처 다이어그램 종합 분석
        </Typography>
        <Box sx={{ textAlign: 'left' }}>
          {overallSummary ? (
            <MarkdownRenderer content={overallSummary} />
          ) : (
            <Alert severity="info">
              문서 파싱에 실패하여 메타데이터만 사용하여 검토를 수행했습니다.
            </Alert>
          )}
        </Box>
      </Paper>
    </Box>
  );

  // Pillar 검토 탭
  const renderPillarTab = () => (
    <Box>
      {/* Pillar 하위 탭 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs 
          value={pillarTab} 
          onChange={(_, v) => setPillarTab(v)} 
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': { 
              fontSize: '0.95rem', 
              fontWeight: 600, 
              textTransform: 'none', 
              minHeight: 56,
              '&.Mui-selected': { 
                color: 'primary.main', 
                bgcolor: 'primary.50' 
              } 
            },
            '& .MuiTabs-indicator': { height: 3 },
          }}
        >
          {pillars.map((p) => (
            <Tab 
              key={p} 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{PILLAR_LABELS[p]}</span>
                  {results[p].recommendations && results[p].recommendations!.length > 0 && (
                    <Chip 
                      label={results[p].recommendations!.length} 
                      size="small" 
                      color="warning"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {/* 선택된 Pillar 내용 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
          {PILLAR_ICONS[currentPillar]} {PILLAR_LABELS[currentPillar]}
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {/* Findings */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main', mb: 2, textAlign: 'left' }}>
            📋 주요 발견사항
          </Typography>
          <Paper sx={{ p: 2.5, bgcolor: 'grey.50', borderLeft: 4, borderColor: 'success.main' }}>
            <Box sx={{ textAlign: 'left' }}>
              <MarkdownRenderer 
                content={(currentResult.findings || '').split(/##\s*권장사항/i)[0].replace(/^##?\s*주요 발견사항.*/i, '').trim()} 
              />
            </Box>
          </Paper>
        </Box>

        {/* Recommendations */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main', mb: 2, textAlign: 'left' }}>
            💡 권장사항 ({(currentResult.recommendations || []).length}개)
          </Typography>
          {(currentResult.recommendations || []).map((rec, idx) => {
            const titleMatch = rec.match(/^\*\*(.+?)\*\*/);
            const title = titleMatch ? titleMatch[1] : `권장사항 ${idx + 1}`;
            
            // 제목을 제거한 내용만 추출
            const content = rec.replace(/^\*\*(.+?)\*\*\s*/, '').trim();
            
            return (
              <Paper key={idx} sx={{ mb: 1.5, p: 2.5, borderLeft: 4, borderColor: 'secondary.main' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'secondary.dark', mb: 1.5, textAlign: 'left' }}>
                  {idx + 1}. {title}
                </Typography>
                <Box sx={{ textAlign: 'left' }}>
                  <MarkdownRenderer content={content} />
                </Box>
              </Paper>
            );
          })}
        </Box>

        {/* Governance Violations */}
        {currentResult.governanceViolations && currentResult.governanceViolations.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main', mb: 2 }}>
              ⚠️ 거버넌스 정책 위반
            </Typography>
            {currentResult.governanceViolations.map((v, i) => (
              <Alert key={i} severity={v.severity === 'High' ? 'error' : 'warning'} sx={{ mb: 2 }}>
                <Typography variant="body1" fontWeight="bold">
                  {v.policyTitle} ({v.severity})
                </Typography>
                <Typography variant="body2">{v.violationDescription}</Typography>
                <Typography variant="body2">
                  <strong>권장 조치:</strong> {v.recommendedCorrection}
                </Typography>
              </Alert>
            ))}
          </Box>
        )}

        {currentResult.error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            <strong>에러:</strong> {currentResult.error}
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
          검토 완료: {currentResult.completedAt ? new Date(currentResult.completedAt).toLocaleString('ko-KR') : 'N/A'}
        </Typography>
      </Paper>
    </Box>
  );

  return (
    <Box>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          검토 결과
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button 
            variant="outlined" 
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPdf}
            disabled={downloading !== null}
            size="small"
          >
            {downloading === 'pdf' ? '다운로드 중...' : 'PDF'}
          </Button>
          <Button 
            variant="contained" 
            startIcon={<DownloadIcon />}
            onClick={handleDownloadWord}
            disabled={downloading !== null}
            size="small"
          >
            {downloading === 'word' ? '다운로드 중...' : 'Word'}
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<CodeIcon />}
            size="small"
            disabled={true}
            title="준비 중"
          >
            IaC 생성
          </Button>
        </Box>
      </Box>

      {/* 메인 탭 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs 
          value={mainTab} 
          onChange={(_, v) => setMainTab(v)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': { 
              fontSize: '1.1rem', 
              fontWeight: 700, 
              textTransform: 'none', 
              minHeight: 64,
              px: 4,
              '&.Mui-selected': { 
                color: 'primary.main', 
                bgcolor: 'primary.50' 
              } 
            },
            '& .MuiTabs-indicator': { height: 4 },
          }}
        >
          <Tab label="종합 요약" />
          <Tab label="아키텍처 다이어그램 분석" />
          <Tab label="아키텍처 영역별 분석" />
        </Tabs>
      </Paper>

      {/* 탭 내용 */}
      <Box sx={{ mt: 3 }}>
        {mainTab === 0 && renderSummaryTab()}
        {mainTab === 1 && renderArchitectureTab()}
        {mainTab === 2 && renderPillarTab()}
      </Box>
    </Box>
  );
}
