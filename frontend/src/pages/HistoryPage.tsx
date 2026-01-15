import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { 
  Visibility as ViewIcon,
  Description as PreviewIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ReviewStatus, ReviewRequest } from '../types';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const mockHistory = [
  {
    reviewRequestId: 'req-001',
    documentTitle: 'E-Commerce 마이크로서비스 아키텍처',
    submitterEmail: 'submitter@example.com',
    reviewerEmail: 'reviewer@example.com',
    status: 'In Review' as ReviewStatus,
    currentVersion: 1,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1일 전
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    reviewRequestId: 'req-002',
    documentTitle: 'IoT 데이터 파이프라인 설계',
    submitterEmail: 'submitter@example.com',
    reviewerEmail: 'reviewer@example.com',
    status: 'Review Completed' as ReviewStatus,
    currentVersion: 2,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2일 전
    updatedAt: new Date().toISOString(), // 방금
  },
  {
    reviewRequestId: 'req-003',
    documentTitle: 'ML 모델 서빙 인프라',
    submitterEmail: 'developer@example.com',
    reviewerEmail: 'reviewer@example.com',
    status: 'Modification Required' as ReviewStatus,
    currentVersion: 1,
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 3일 전
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1일 전
  },
];

export function HistoryPage() {
  const [history, setHistory] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'All'>('All');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReviewRequest | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Requester_Group 사용자인지 확인
  const isRequester = user?.group === 'Requester_Group';
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const result = await api.listReviewRequests();
      setHistory(result.reviewRequests);
    } catch (err: any) {
      // Fallback to mock data for local development
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        console.warn('API not available, using mock data');
        setHistory(mockHistory);
      } else {
        setError(err.response?.data?.error || '히스토리를 불러오는데 실패했습니다');
        setHistory(mockHistory); // Fallback to mock
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: ReviewStatus): string => {
    switch (status) {
      case 'Pending Review':
        return '검토 대기 중';
      case 'In Review':
        return '검토 중';
      case 'Modification Required':
        return '수정 필요';
      case 'Review Completed':
        return '검토 완료';
      case 'Rejected':
        return '반려됨';
      default:
        return status;
    }
  };

  const getStatusColor = (status: ReviewStatus) => {
    switch (status) {
      case 'Pending Review':
        return 'warning';
      case 'In Review':
        return 'info';
      case 'Review Completed':
        return 'success';
      case 'Modification Required':
        return 'warning';
      case 'Rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleViewDetails = (item: ReviewRequest) => {
    console.log('View details clicked:', {
      reviewRequestId: item.reviewRequestId,
      status: item.status,
      executionId: item.executionId,
      documentTitle: item.documentTitle,
    });

    // 검토 완료된 경우 결과 페이지로
    if (item.status === 'Review Completed' && item.executionId) {
      console.log('Navigating to results page:', item.executionId);
      navigate(`/reviews/${item.executionId}/results`);
    } 
    // 검토 대기 중인 경우 검토 실행 페이지로
    else if (item.status === 'Pending Review') {
      console.log('Navigating to execute page (pending):', item.reviewRequestId);
      navigate(`/reviews/${item.reviewRequestId}/execute`);
    }
    // 검토 중이거나 기타 상태인 경우 검토 실행 페이지로
    else {
      console.log('Navigating to execute page (other):', item.reviewRequestId);
      navigate(`/reviews/${item.reviewRequestId}/execute`);
    }
  };

  const handlePreview = async (item: ReviewRequest) => {
    try {
      const url = await api.getDocumentPreviewUrl(item.documentId);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (err: any) {
      setError('문서 프리뷰를 불러오는데 실패했습니다');
    }
  };

  const handleDeleteClick = (item: ReviewRequest) => {
    setDeleteTarget(item);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await api.deleteReviewRequest(deleteTarget.reviewRequestId);
      
      // Remove from list
      setHistory(prev => prev.filter(h => h.reviewRequestId !== deleteTarget.reviewRequestId));
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err.response?.data?.error || '삭제에 실패했습니다');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadReport = async (item: ReviewRequest) => {
    if (!item.executionId) {
      setError('검토 결과가 없습니다');
      return;
    }

    try {
      setDownloading(item.reviewRequestId);
      
      // Download PDF report
      const blob = await api.downloadPdfReport(item.executionId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `architecture-review-${item.documentTitle || item.documentId}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || '리포트 다운로드에 실패했습니다');
    } finally {
      setDownloading(null);
    }
  };

  const getSubmitterDisplay = (item: ReviewRequest): string => {
    // 이메일 주소를 우선적으로 표시
    return item.submitterEmail || item.submitterUserId || 'Unknown';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const filteredHistory = history.filter(item => {
    const documentTitle = item.documentTitle || item.documentId;
    const submitterDisplay = getSubmitterDisplay(item);
    const matchesSearch = documentTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         submitterDisplay.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.submitterEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700} sx={{ mb: 3 }}>
        아키텍처 리뷰 히스토리
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="검색"
            placeholder="문서 제목 또는 제출자"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flexGrow: 1 }}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>상태 필터</InputLabel>
            <Select
              value={statusFilter}
              label="상태 필터"
              onChange={(e) => setStatusFilter(e.target.value as ReviewStatus | 'All')}
            >
              <MenuItem value="All">전체</MenuItem>
              <MenuItem value="Pending Review">검토 대기 중</MenuItem>
              <MenuItem value="In Review">검토 중</MenuItem>
              <MenuItem value="Modification Required">수정 필요</MenuItem>
              <MenuItem value="Review Completed">검토 완료</MenuItem>
              <MenuItem value="Rejected">반려됨</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>문서 제목</TableCell>
                  <TableCell>제출자</TableCell>
                  <TableCell>검토자</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>버전</TableCell>
                  <TableCell>생성일</TableCell>
                  <TableCell>최종 검토일</TableCell>
                  <TableCell align="center">작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredHistory.map((item) => (
                  <TableRow key={item.reviewRequestId} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.documentTitle || item.documentId}
                      </Typography>
                    </TableCell>
                    <TableCell>{getSubmitterDisplay(item)}</TableCell>
                    <TableCell>{item.reviewerEmail}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(item.status)}
                        color={getStatusColor(item.status)}
                        size="small"
                        sx={{ borderRadius: '4px' }}
                      />
                    </TableCell>
                    <TableCell>v{item.currentVersion}</TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                    <TableCell>{formatDate(item.updatedAt)}</TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title="문서 미리보기">
                          <IconButton 
                            size="small" 
                            color="info"
                            onClick={() => handlePreview(item)}
                          >
                            <PreviewIcon />
                          </IconButton>
                        </Tooltip>
                        {item.status === 'Review Completed' && (
                          <Tooltip title="검토 결과 보기">
                            <span>
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => handleViewDetails(item)}
                                disabled={!item.executionId}
                              >
                                <ViewIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {item.status === 'Review Completed' && (
                          <Tooltip title="리포트 다운로드">
                            <span>
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={() => handleDownloadReport(item)}
                                disabled={!item.executionId || downloading === item.reviewRequestId}
                              >
                                {downloading === item.reviewRequestId ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <DownloadIcon />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        <Tooltip title={
                          item.status === 'Pending Review' ? '삭제' :
                          item.status === 'In Review' ? '검토 중일 때는 삭제 불가' :
                          item.status === 'Review Completed' ? '검토 완료된 항목은 삭제 불가' :
                          '삭제'
                        }>
                          <span>
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleDeleteClick(item)}
                              disabled={item.status === 'In Review' || item.status === 'Review Completed'}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredHistory.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                검색 결과가 없습니다.
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* 문서 프리뷰 다이얼로그 */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>문서 프리뷰</DialogTitle>
        <DialogContent>
          <Box sx={{ height: '70vh', width: '100%' }}>
            <iframe
              src={previewUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Document Preview"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
      >
        <DialogTitle>검토 요청 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            "{deleteTarget?.documentTitle || deleteTarget?.documentId}"를 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
            취소
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleting}
          >
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
