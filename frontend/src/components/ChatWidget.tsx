import { useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Fade,
  SvgIcon,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { createEmbeddingContext } from 'amazon-quicksight-embedding-sdk';

// QuickSight 스타일 채팅 아이콘 (실제 QuickSight 콘솔과 동일)
function QuickSightChatIcon(props: any) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M14.07,6.42l2.34.91.92,2.32c.06.15.2.25.37.25s.31-.1.37-.25l.92-2.32,2.34-.91c.15-.06.25-.2.25-.36s-.1-.3-.25-.36l-2.34-.91-.92-2.32c-.06-.15-.2-.25-.37-.25s-.31.1-.37.25l-.92,2.32-2.34.91c-.15.06-.25.2-.25.36s.1.3.25.36Z"></path>
      <path d="M20.78,16.85c.8-1.38,1.22-2.92,1.22-4.49,0-.54-.05-1.08-.15-1.61-.1-.54-.62-.9-1.16-.8-.54.1-.9.62-.8,1.16.08.41.11.83.11,1.25,0,1.33-.39,2.64-1.13,3.79-.15.24-.2.53-.12.8l.58,2.15-2.24-.6c-.26-.07-.54-.03-.77.11-1.29.77-2.78,1.18-4.31,1.18-4.41,0-8-3.33-8-7.42s3.59-7.42,8-7.42c.55,0,1-.45,1-1s-.45-1-1-1C6.49,2.94,2,7.16,2,12.36s4.49,9.42,10,9.42c1.74,0,3.44-.43,4.95-1.25l3.52.94c.35.09.71,0,.97-.26.25-.25.35-.62.26-.97l-.91-3.41Z"></path>
    </SvgIcon>
  );
}

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onWidthChange?: (width: number) => void;
}

function ChatWidget({ isOpen, onClose, onWidthChange }: ChatWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [width, setWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (isOpen && !embedUrl) {
      loadEmbedUrl();
    }
  }, [isOpen]);

  useEffect(() => {
    if (onWidthChange) {
      onWidthChange(width);
    }
  }, [width, onWidthChange]);

  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 300 && newWidth <= 800) {
          setWidth(newWidth);
        }
      };

      const handleMouseUp = () => {
        setIsResizing(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const loadEmbedUrl = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL;
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`${apiBaseUrl}/quicksight/embed-url`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to load embed URL');
      }
      
      const data = await response.json();
      setEmbedUrl(data.embedUrl);
      console.log('QuickSight embed URL loaded');
      
      // Embed using SDK with Agent ID from backend
      await embedQuickChat(data.embedUrl, data.agentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat');
      console.error('Error loading QuickSight embed URL:', err);
    } finally {
      setLoading(false);
    }
  };

  const embedQuickChat = async (url: string, agentId?: string) => {
    if (!containerRef.current) return;

    try {
      // Agent ID must be provided from backend
      if (!agentId) {
        setError('QuickSuite Agent가 설정되지 않았습니다. README의 QuickSuite MCP 연동 섹션을 참조하세요.');
        return;
      }
      const finalAgentId = agentId;
      
      const embeddingContext = await createEmbeddingContext();

      const frameOptions = {
        url,
        container: containerRef.current,
        height: '100%',
        width: '100%',
        onChange: (changeEvent: any) => {
          console.log('QuickChat frame event:', changeEvent.eventName);
        },
      };

      const contentOptions = {
        locale: 'ko-KR',
        agentOptions: {
          fixedAgentId: finalAgentId,  // Agent ID from backend
        },
        onMessage: async (messageEvent: any) => {
          console.log('QuickChat message:', messageEvent.eventName);
          if (messageEvent.eventName === 'ERROR_OCCURRED') {
            setError('채팅 로드 중 오류가 발생했습니다');
          }
        },
      };

      await embeddingContext.embedQuickChat(frameOptions, contentOptions);
      console.log('QuickChat embedded successfully with agent:', finalAgentId);
    } catch (err) {
      console.error('Error embedding QuickChat:', err);
      setError('채팅 임베딩에 실패했습니다');
    }
  };

  return (
    <>
      {/* Resize Handle */}
      {isOpen && (
        <Box
          onMouseDown={handleResizeStart}
          sx={{
            position: 'fixed',
            top: 70,
            right: width,
            width: 8,
            height: 'calc(100vh - 70px)',
            cursor: 'ew-resize',
            bgcolor: isResizing ? 'primary.main' : 'transparent',
            zIndex: 1300,
            '&:hover': {
              bgcolor: 'primary.light',
            },
            '&:active': {
              bgcolor: 'primary.main',
            },
            transition: 'background-color 0.2s',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 3,
              height: 40,
              bgcolor: isResizing ? 'white' : 'grey.400',
              borderRadius: 1,
              pointerEvents: 'none',
            }}
          />
        </Box>
      )}

      {/* Chat Panel */}
      <Fade in={isOpen}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            top: 70,
            right: 0,
            width: `${width}px`,
            height: 'calc(100vh - 70px)',
            zIndex: 1299,
            display: isOpen ? 'flex' : 'none',
            flexDirection: 'column',
            borderRadius: 0,
            borderTopLeftRadius: 16,
            overflow: 'hidden',
            borderLeft: '1px solid #e0e0e0',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <QuickSightChatIcon />
              <Typography variant="h6" fontWeight={600}>
                Quick Suite Agent
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, position: 'relative', bgcolor: 'grey.50' }}>
            {loading && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  gap: 2,
                }}
              >
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">
                  채팅 에이전트를 로드하는 중...
                </Typography>
              </Box>
            )}

            {error && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
                <Typography variant="body2" color="text.secondary">
                  채팅 에이전트를 로드할 수 없습니다.
                </Typography>
              </Box>
            )}

            {/* QuickChat Container */}
            <Box
              ref={containerRef}
              sx={{
                width: '100%',
                height: '100%',
                display: embedUrl && !loading && !error ? 'block' : 'none',
              }}
            />

            {!loading && !error && !embedUrl && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  p: 3,
                  textAlign: 'center',
                  gap: 2,
                }}
              >
                <QuickSightChatIcon sx={{ fontSize: 64, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  Quick Suite Agent
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  채팅 아이콘을 클릭하여 AI 어시스턴트와 대화를 시작하세요
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Fade>
    </>
  );
}

export default ChatWidget;
