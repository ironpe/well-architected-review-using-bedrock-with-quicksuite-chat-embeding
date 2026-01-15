import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ReviewStatus, ReviewRequest } from '../types';
import { api } from '../services/api';

export function DashboardPage() {
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ReviewRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'All'>('All');
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const result = await api.listReviewRequests();
      // 모든 검토 요청 표시 (필터링 제거)
      setReviews(result.reviewRequests);
      
      // Load review counts for each request
      const counts: Record<string, number> = {};
      for (const review of result.reviewRequests) {
        try {
          const executions = await api.getReviewExecutions(review.reviewRequestId);
          counts[review.reviewRequestId] = executions.executions?.length || 0;
        } catch (err) {
          console.warn(`Failed to load execution count for ${review.reviewRequestId}`);
          counts[review.reviewRequestId] = 0;
        }
      }
      setReviewCounts(counts);
    } catch (err: any) {
      // Fallback to mock data
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        console.warn('API not available, using mock data');
        setReviews([
          {
            reviewRequestId: 'req-001',
            documentId: 'doc-001',
            submitterEmail: 'submitter@example.com',
            submitterUserId: 'user-1',
            reviewerEmail: 'reviewer@example.com',
            status: 'Pending Review',
            currentVersion: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
      } else {
        setError(err.response?.data?.error || '검토 요청을 불러오는데 실패했습니다');
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

  const handleRejectClick = (review: ReviewRequest) => {
    setSelectedReview(review);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedReview || !rejectionReason.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      await api.updateReviewRequestStatus(selectedReview.reviewRequestId, {
        status: 'Rejected',
        comment: rejectionReason,
      });

      // Reload reviews
      await loadReviews();
      setRejectDialogOpen(false);
      setSelectedReview(null);
      setRejectionReason('');
    } catch (err: any) {
      setError(err.response?.data?.error || '반려 처리에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = async (review: ReviewRequest) => {
    try {
      const url = await api.getDocumentPreviewUrl(review.documentId);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (err: any) {
      setError('문서 미리보기를 불러오는데 실패했습니다');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  // 필터링된 검토 요청
  const filteredReviews = reviews.filter(review => {
    const documentTitle = review.documentTitle || review.documentId;
    const matchesSearch = documentTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.submitterEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.reviewRequestId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || review.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700} sx={{ mb: 3 }}>
        아키텍처 리뷰 대시보드
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 검색 및 필터 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="검색"
            placeholder="문서 제목, 제출자, 요청 ID"
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

      {/* 통계 요약 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          전체 검토 요청: {reviews.length}개 {searchTerm || statusFilter !== 'All' ? `(필터링: ${filteredReviews.length}개)` : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Chip 
            label={`대기 중: ${reviews.filter(r => r.status === 'Pending Review').length}개`} 
            color="warning" 
            size="small"
            sx={{ borderRadius: '4px' }}
          />
          <Chip 
            label={`검토 중: ${reviews.filter(r => r.status === 'In Review').length}개`} 
            color="info" 
            size="small"
            sx={{ borderRadius: '4px' }}
          />
          <Chip 
            label={`완료: ${reviews.filter(r => r.status === 'Review Completed').length}개`} 
            color="success" 
            size="small"
            sx={{ borderRadius: '4px' }}
          />
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={3}>
            {filteredReviews.map((review) => (
              <Grid item xs={12} md={6} key={review.reviewRequestId}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                      <Typography variant="h6" component="div">
                        {review.documentTitle || review.documentId}
                      </Typography>
                      <Chip 
                        label={getStatusLabel(review.status)} 
                        color={getStatusColor(review.status)} 
                        size="small"
                        sx={{ borderRadius: '4px' }}
                      />
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ textAlign: 'left' }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>제출자:</strong> {review.submitterEmail}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>문서 버전:</strong> v{review.currentVersion}
                      </Typography>
                      {reviewCounts[review.reviewRequestId] > 0 && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          <strong>검토 횟수:</strong> {reviewCounts[review.reviewRequestId]}회
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>요청일:</strong> {formatDate(review.createdAt)}
                      </Typography>
                      {review.executionId && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          <strong>최근 검토:</strong> {formatDate(review.updatedAt)}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        <strong>ID:</strong> {review.reviewRequestId}
                      </Typography>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                    {/* 문서 미리보기 버튼 - 항상 활성화 */}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handlePreview(review)}
                    >
                      문서 미리보기
                    </Button>
                    
                    {/* 상세보기 버튼 - 검토 완료된 경우 */}
                    {review.status === 'Review Completed' && review.executionId && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/reviews/${review.executionId}/results`)}
                      >
                        상세보기
                      </Button>
                    )}
                    
                    {/* 반려 버튼 - 대기 중인 경우만 */}
                    {review.status === 'Pending Review' && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleRejectClick(review)}
                      >
                        반려
                      </Button>
                    )}
                    
                    {/* 재검토 버튼 - 검토 완료된 경우 */}
                    {review.status === 'Review Completed' ? (
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => navigate(`/reviews/${review.reviewRequestId}/execute`, {
                          state: { documentTitle: review.documentTitle || review.documentId }
                        })}
                      >
                        재검토
                      </Button>
                    ) : (
                      /* 검토 시작 버튼 - 대기 중인 경우 */
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => navigate(`/reviews/${review.reviewRequestId}/execute`, {
                          state: { documentTitle: review.documentTitle || review.documentId }
                        })}
                      >
                        검토 시작
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {filteredReviews.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {searchTerm || statusFilter !== 'All' 
                  ? '검색 결과가 없습니다.' 
                  : '현재 대기 중인 검토 요청이 없습니다.'}
              </Typography>
            </Paper>
          )}
        </>
      )}

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>검토 요청 반려</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            반려 사유를 입력해주세요. 이 내용은 요청자에게 전달됩니다.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="반려 사유"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="예: 아키텍처 설계가 불충분합니다. 보안 요구사항을 추가해주세요."
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={submitting}>
            취소
          </Button>
          <Button
            onClick={handleRejectConfirm}
            variant="contained"
            color="error"
            disabled={submitting || !rejectionReason.trim()}
          >
            {submitting ? '처리 중...' : '반려 확정'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 문서 미리보기 다이얼로그 */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>문서 미리보기</DialogTitle>
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
    </Box>
  );
}
