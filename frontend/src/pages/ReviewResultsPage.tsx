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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { 
  Download as DownloadIcon, 
  Code as CodeIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { PillarName, PillarResult, CostBreakdown, GovernanceAnalysisResult } from '../types';
import { api } from '../services/api';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { useLanguage } from '../contexts/LanguageContext';

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
  const [mainTab, setMainTab] = useState(0);
  const [pillarTab, setPillarTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<string, PillarResult>>({});
  const [overallSummary, setOverallSummary] = useState<string>('');
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [governanceAnalysis, setGovernanceAnalysis] = useState<GovernanceAnalysisResult | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'word' | null>(null);
  const { t, language } = useLanguage();
  const PILLAR_LABELS = language === 'ko' ? PILLAR_LABELS_KO : PILLAR_LABELS_EN;

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
      setCostBreakdown(response.reviewReport.costBreakdown || null);
      setGovernanceAnalysis(response.reviewReport.governanceAnalysis || null);
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
    return <Alert severity="info">{t('results.noResults')}</Alert>;
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
              {t('results.reviewSummary')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'left' }}>
              {pillars.length}{language === 'ko' ? '개 아키텍처 영역에 대한 검토가 완료되었습니다.' : ' architecture areas have been reviewed.'}
              {' '}{language === 'ko' ? '총' : 'Total'} {pillars.reduce((sum, p) => sum + (results[p].recommendations?.length || 0), 0)}{language === 'ko' ? '개의 개선 권장사항이 도출되었습니다.' : ' improvement recommendations were identified.'}
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
                    {t('results.reviewCompleted')}
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  {pillars.filter(p => !results[p].error).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  / {pillars.length} {t('results.areas')}
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
                    {t('results.improvements')}
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  {pillars.reduce((sum, p) => sum + (results[p].recommendations?.length || 0), 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('results.recommendations')}
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
                    {t('results.policyViolations')}
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  {pillars.reduce((sum, p) => sum + (results[p].governanceViolations?.length || 0), 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('results.violations')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 우선순위별 개선 제안 */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, textAlign: 'left' }}>
            {t('results.priorityImprovements')}
          </Typography>
          
          {/* High Priority */}
          {pillars.some(p => results[p].governanceViolations?.some(v => v.severity === 'High')) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main', mb: 2, textAlign: 'left' }}>
                {t('results.highPriority')}
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
              {t('results.mediumPriority')}
            </Typography>
            {pillars.slice(0, 3).map(pillar => 
              results[pillar].recommendations?.slice(0, 2).map((rec, i) => {
                const titleMatch = rec.match(/^\*\*(.+?)\*\*/);
                const title = titleMatch ? titleMatch[1] : `${language === 'ko' ? '권장사항' : 'Recommendation'} ${i + 1}`;
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
              {t('results.lowPriority')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
              {t('results.lowPriorityDesc')}
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
          {t('results.architectureAnalysis')}
        </Typography>
        <Box sx={{ textAlign: 'left' }}>
          {overallSummary ? (
            <MarkdownRenderer content={overallSummary} />
          ) : (
            <Alert severity="info">
              {t('results.parsingFailed')}
            </Alert>
          )}
        </Box>
      </Paper>
    </Box>
  );

  // 비용 분석 탭
  const renderCostTab = () => {
    if (!costBreakdown) {
      return <Alert severity="info">{t('cost.noData')}</Alert>;
    }

    const serviceSummary = [
      { key: 'bedrock', label: t('cost.bedrock'), cost: costBreakdown.breakdown.bedrock, color: '#ff9800' },
      { key: 's3', label: t('cost.s3'), cost: costBreakdown.breakdown.s3, color: '#4caf50' },
      { key: 'dynamodb', label: t('cost.dynamodb'), cost: costBreakdown.breakdown.dynamodb, color: '#2196f3' },
      { key: 'lambda', label: t('cost.lambda'), cost: costBreakdown.breakdown.lambda, color: '#9c27b0' },
      { key: 'other', label: t('cost.other'), cost: costBreakdown.breakdown.other, color: '#607d8b' },
    ].filter(s => s.cost > 0);

    const bedrockItems = costBreakdown.items.filter(i => i.service === 'Amazon Bedrock');
    const otherItems = costBreakdown.items.filter(i => i.service !== 'Amazon Bedrock');

    const SERVICE_COLORS: Record<string, string> = {
      'Amazon S3': '#4caf50', 'Amazon DynamoDB': '#2196f3', 'AWS Lambda': '#9c27b0',
    };

    return (
      <Box>
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50', borderLeft: 4, borderColor: 'primary.main' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: 'primary.main' }}>
            {t('cost.title')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 2 }}>
            <Typography variant="h3" sx={{ fontWeight: 700 }}>${costBreakdown.totalCost.toFixed(4)}</Typography>
            <Typography variant="h6" color="text.secondary">USD</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t('cost.disclaimer')}
          </Typography>
        </Paper>

        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t('cost.serviceSummary')}</Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {serviceSummary.map(s => (
            <Grid item xs={6} md={3} key={s.key}>
              <Card sx={{ borderLeft: 4, borderColor: s.color }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>${s.cost.toFixed(4)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {costBreakdown.totalCost > 0 ? `${((s.cost / costBreakdown.totalCost) * 100).toFixed(1)}%` : '0%'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {bedrockItems.length > 0 && (
          <Paper sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, p: 2, pb: 0 }}>
              {t('cost.detailTitle')} - Amazon Bedrock
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{t('cost.operation')}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t('cost.model')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t('cost.inputTokens')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t('cost.outputTokens')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t('cost.images')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t('cost.unitCost')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bedrockItems.map((item, idx) => {
                    const shortModel = item.modelId?.split('.').pop()?.split('-').slice(0, 3).join('-') || '-';
                    return (
                      <TableRow key={idx}>
                        <TableCell>{item.operation}</TableCell>
                        <TableCell><Chip label={shortModel} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} /></TableCell>
                        <TableCell align="right">{item.inputTokens?.toLocaleString() || '-'}</TableCell>
                        <TableCell align="right">{item.outputTokens?.toLocaleString() || '-'}</TableCell>
                        <TableCell align="right">{item.imageCount || '-'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>${item.cost.toFixed(6)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Bedrock {t('cost.totalCost')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{bedrockItems.reduce((s, i) => s + (i.inputTokens || 0), 0).toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{bedrockItems.reduce((s, i) => s + (i.outputTokens || 0), 0).toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{bedrockItems.reduce((s, i) => s + (i.imageCount || 0), 0) || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>${costBreakdown.breakdown.bedrock.toFixed(6)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {otherItems.length > 0 && (
          <Paper>
            <Typography variant="h6" sx={{ fontWeight: 700, p: 2, pb: 0 }}>
              {t('cost.detailTitle')} - {t('cost.other')}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{t('cost.service')}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t('cost.operation')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{t('cost.unitCost')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {otherItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Chip label={item.service} size="small" sx={{ bgcolor: SERVICE_COLORS[item.service] || '#607d8b', color: 'white', fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell>{item.operation}</TableCell>
                      <TableCell align="right">${item.cost.toFixed(6)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Box>
    );
  };

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
            {t('results.keyFindings')}
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
            {t('results.recommendationsTitle')} ({(currentResult.recommendations || []).length}{language === 'ko' ? '개' : ''})
          </Typography>
          {(currentResult.recommendations || []).map((rec, idx) => {
            const titleMatch = rec.match(/^\*\*(.+?)\*\*/);
            const title = titleMatch ? titleMatch[1] : `${language === 'ko' ? '권장사항' : 'Recommendation'} ${idx + 1}`;
            
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
              {t('results.governanceViolations')}
            </Typography>
            {currentResult.governanceViolations.map((v, i) => (
              <Alert key={i} severity={v.severity === 'High' ? 'error' : 'warning'} sx={{ mb: 2 }}>
                <Typography variant="body1" fontWeight="bold">
                  {v.policyTitle} ({v.severity})
                </Typography>
                <Typography variant="body2">{v.violationDescription}</Typography>
                <Typography variant="body2">
                  <strong>{t('results.recommendedAction')}:</strong> {v.recommendedCorrection}
                </Typography>
              </Alert>
            ))}
          </Box>
        )}

        {currentResult.error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            <strong>{t('common.error')}:</strong> {currentResult.error}
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
          {t('results.reviewCompletedAt')}: {currentResult.completedAt ? new Date(currentResult.completedAt).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US') : 'N/A'}
        </Typography>
      </Paper>
    </Box>
  );

  // 거버넌스 준수 탭
  const renderGovernanceTab = () => {
    if (!governanceAnalysis) {
      return <Alert severity="info">{t('governance.noData')}</Alert>;
    }

    const statusColor = (status: string) => {
      switch (status) {
        case 'Compliant': return 'success';
        case 'Non-Compliant': return 'error';
        case 'Partially Compliant': return 'warning';
        default: return 'default';
      }
    };

    const statusLabel = (status: string) => {
      if (language === 'ko') {
        switch (status) {
          case 'Compliant': return '준수';
          case 'Non-Compliant': return '미준수';
          case 'Partially Compliant': return '부분 준수';
          default: return '해당 없음';
        }
      }
      return status;
    };

    return (
      <Box>
        {/* 전체 요약 */}
        <Paper sx={{ p: 3, mb: 3, borderLeft: 4, borderColor: statusColor(governanceAnalysis.overallStatus) + '.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('governance.title')}
            </Typography>
            <Chip
              label={statusLabel(governanceAnalysis.overallStatus)}
              color={statusColor(governanceAnalysis.overallStatus) as any}
              sx={{ fontWeight: 700 }}
            />
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {governanceAnalysis.summary}
          </Typography>
        </Paper>

        {/* 통계 카드 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Card sx={{ borderLeft: 4, borderColor: 'success.main' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">{t('governance.compliant')}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>{governanceAnalysis.compliantCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ borderLeft: 4, borderColor: 'error.main' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">{t('governance.nonCompliant')}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>{governanceAnalysis.nonCompliantCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ borderLeft: 4, borderColor: 'warning.main' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">{t('governance.partiallyCompliant')}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>{governanceAnalysis.partiallyCompliantCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ borderLeft: 4, borderColor: 'grey.400' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">{t('governance.notApplicable')}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.secondary' }}>{governanceAnalysis.notApplicableCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 정책별 상세 결과 */}
        {governanceAnalysis.policyResults.map((result, idx) => (
          <Paper key={idx} sx={{ p: 3, mb: 2, borderLeft: 4, borderColor: statusColor(result.status) + '.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {result.policyTitle}
              </Typography>
              <Chip
                label={statusLabel(result.status)}
                color={statusColor(result.status) as any}
                size="small"
              />
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {result.findings}
            </Typography>

            {result.violations.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'error.main', mb: 1 }}>
                  {t('governance.violationsFound')} ({result.violations.length})
                </Typography>
                {result.violations.map((v, vi) => (
                  <Alert key={vi} severity={v.severity === 'High' ? 'error' : v.severity === 'Medium' ? 'warning' : 'info'} sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      [{v.severity}] {v.rule}
                    </Typography>
                    <Typography variant="body2">{v.description}</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      <strong>{t('governance.recommendation')}:</strong> {v.recommendation}
                    </Typography>
                  </Alert>
                ))}
              </Box>
            )}

            {result.recommendations.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'info.main', mb: 1 }}>
                  {t('governance.recommendations')}
                </Typography>
                {result.recommendations.map((rec, ri) => (
                  <Typography key={ri} variant="body2" sx={{ ml: 2, mb: 0.5 }}>
                    • {rec}
                  </Typography>
                ))}
              </Box>
            )}
          </Paper>
        ))}
      </Box>
    );
  };

  return (
    <Box>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {t('results.pageTitle')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button 
            variant="outlined" 
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPdf}
            disabled={downloading !== null}
            size="small"
          >
            {downloading === 'pdf' ? `${language === 'ko' ? '다운로드 중...' : 'Downloading...'}` : 'PDF'}
          </Button>
          <Button 
            variant="contained" 
            startIcon={<DownloadIcon />}
            onClick={handleDownloadWord}
            disabled={downloading !== null}
            size="small"
          >
            {downloading === 'word' ? `${language === 'ko' ? '다운로드 중...' : 'Downloading...'}` : 'Word'}
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<CodeIcon />}
            size="small"
            disabled={true}
            title={t('results.preparing')}
          >
            {t('results.iacGeneration')}
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
              fontSize: '0.92rem', 
              fontWeight: 700, 
              textTransform: 'none', 
              minHeight: 64,
              px: 1.5,
              whiteSpace: 'nowrap',
              '&.Mui-selected': { 
                color: 'primary.main', 
                bgcolor: 'primary.50' 
              } 
            },
            '& .MuiTabs-indicator': { height: 4 },
          }}
        >
          <Tab label={t('results.summaryTab')} />
          <Tab label={t('results.architectureTab')} />
          <Tab label={t('results.pillarTab')} />
          <Tab label={t('governance.tabTitle')} />
          <Tab label={t('cost.tabTitle')} />
        </Tabs>
      </Paper>

      {/* 탭 내용 */}
      <Box sx={{ mt: 3 }}>
        {mainTab === 0 && renderSummaryTab()}
        {mainTab === 1 && renderArchitectureTab()}
        {mainTab === 2 && renderPillarTab()}
        {mainTab === 3 && renderGovernanceTab()}
        {mainTab === 4 && renderCostTab()}
      </Box>
    </Box>
  );
}
