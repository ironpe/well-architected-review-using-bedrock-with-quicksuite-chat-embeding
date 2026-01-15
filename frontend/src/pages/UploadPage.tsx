import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DocumentFormat } from '../types';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<DocumentFormat>('pdf');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const validateAndSetFile = (selectedFile: File) => {
    // PPT 파일 거부
    if (selectedFile.name.match(/\.(ppt|pptx)$/i)) {
      setError('PPT 파일은 지원하지 않습니다. PDF 또는 이미지 파일(PNG, JPG)로 변환하여 업로드해주세요.');
      setFile(null);
      return false;
    }
    
    // 허용된 파일 형식 확인
    if (!selectedFile.name.match(/\.(pdf|png|jpg|jpeg)$/i)) {
      setError('지원하지 않는 파일 형식입니다. PDF 또는 이미지 파일(PNG, JPG)만 업로드 가능합니다.');
      setFile(null);
      return false;
    }
    
    setFile(selectedFile);
    setError('');
    
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
    
    // 파일 확장자에 따라 format 자동 설정
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      setFormat('pdf');
    } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
      setFormat('png');
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const isValid = validateAndSetFile(e.target.files[0]);
      if (!isValid) {
        e.target.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!file) {
      setError('파일을 선택해주세요');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get presigned URL
      setUploadStep('업로드 준비 중...');
      setUploadProgress(5);

      const uploadResult = await api.uploadDocument(
        file, 
        {
          title,
          description,
          format,
          submitterUserId: user?.userId || 'mock-user',
        },
        (progress) => {
          // Real-time progress from S3 upload
          setUploadProgress(5 + (progress * 0.9)); // 5% ~ 95%
          setUploadStep(`파일 업로드 중... ${progress}%`);
        }
      );

      setUploadProgress(100);
      setUploadStep('업로드 완료');

      // Step 2: Create review request
      setUploadStep('검토 요청 생성 중...');
      await api.createReviewRequest({
        documentId: uploadResult.documentId,
        title,
        description,
        submitterEmail: user?.email || 'local@example.com',
        submitterName: user?.name || 'Local User',
        reviewerEmail,
      });
      
      setSuccess(true);
      setFile(null);
      setTitle('');
      setDescription('');
      setReviewerEmail('');
      setUploadStep('');

      // Navigate to my requests after 2 seconds
      setTimeout(() => {
        navigate('/my-requests');
      }, 2000);
    } catch (err: any) {
      console.error('Upload error:', err);
      const errorMsg = err.response?.data?.error || err.message || '업로드에 실패했습니다';
      
      // 413 에러 특별 처리
      if (err.response?.status === 413) {
        setError('파일 크기가 너무 큽니다. 최대 100MB까지 업로드 가능합니다.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStep('');
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700} sx={{ mb: 3 }}>
        아키텍처 문서 업로드
      </Typography>

      <Paper sx={{ p: 3, mt: 2 }}>
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
            문서가 성공적으로 업로드되었습니다. 검토자에게 알림이 발송되었습니다.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Box
            sx={{
              border: isDragOver ? '2px dashed' : '2px dashed #ccc',
              borderColor: isDragOver ? 'primary.main' : '#ccc',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              mb: 3,
              cursor: 'pointer',
              bgcolor: isDragOver ? 'action.hover' : 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
            }}
            onClick={() => document.getElementById('file-input')?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              id="file-input"
              type="file"
              hidden
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
            />
            <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body1">
              {file ? file.name : '파일을 선택하거나 드래그하세요'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              지원 형식: PDF, PNG, JPG (최대 100MB)
            </Typography>
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
              ⚠️ PPT 파일은 지원하지 않습니다. PDF로 변환하여 업로드해주세요.
            </Typography>
          </Box>

          <TextField
            fullWidth
            label="문서 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="문서 설명"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            multiline
            rows={4}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>문서 형식</InputLabel>
            <Select
              value={format}
              label="문서 형식"
              onChange={(e) => setFormat(e.target.value as DocumentFormat)}
            >
              <MenuItem value="pdf">PDF</MenuItem>
              <MenuItem value="png">이미지 (PNG/JPG)</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="검토자 이메일"
            type="email"
            value={reviewerEmail}
            onChange={(e) => setReviewerEmail(e.target.value)}
            required
            helperText="검토를 요청할 CCoE 팀원의 이메일 주소"
            sx={{ mb: 3 }}
          />

          {uploading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {uploadStep}
              </Typography>
            </Box>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={uploading || !file}
          >
            {uploading ? '업로드 중...' : '검토 요청하기'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
