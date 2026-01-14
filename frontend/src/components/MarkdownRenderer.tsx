import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Typography, Box, Link, Divider } from '@mui/material';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ node, ...props }) => (
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mt: 3, mb: 2, color: 'primary.main' }} {...props} />
        ),
        h2: ({ node, ...props }) => (
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mt: 2.5, mb: 1.5, color: 'primary.dark' }} {...props} />
        ),
        h3: ({ node, ...props }) => (
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mt: 2, mb: 1, color: 'text.primary' }} {...props} />
        ),
        h4: ({ node, ...props }) => (
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mt: 1.5, mb: 0.5 }} {...props} />
        ),
        p: ({ node, ...props }) => (
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.7, mb: 1.5, textAlign: 'left' }} {...props} />
        ),
        ul: ({ node, ...props }) => (
          <Box component="ul" sx={{ pl: 3, my: 1, textAlign: 'left' }} {...props} />
        ),
        ol: ({ node, ...props }) => (
          <Box component="ol" sx={{ pl: 3, my: 1, textAlign: 'left' }} {...props} />
        ),
        li: ({ node, ...props }) => (
          <Typography component="li" variant="body2" sx={{ mb: 0.5, lineHeight: 1.6 }} {...props} />
        ),
        strong: ({ node, ...props }) => (
          <Box component="strong" sx={{ fontWeight: 700, color: 'primary.main' }} {...props} />
        ),
        em: ({ node, ...props }) => (
          <Box component="em" sx={{ fontStyle: 'italic', color: 'text.secondary' }} {...props} />
        ),
        code: ({ node, inline, ...props }: any) => (
          inline ? (
            <Box component="code" sx={{ 
              bgcolor: 'grey.100', 
              px: 0.75, 
              py: 0.25, 
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.875em',
              color: 'error.main',
            }} {...props} />
          ) : (
            <Box component="pre" sx={{ 
              bgcolor: 'grey.100', 
              p: 2, 
              borderRadius: 1,
              overflow: 'auto',
              my: 2,
            }}>
              <Box component="code" sx={{ fontFamily: 'monospace', fontSize: '0.875em' }} {...props} />
            </Box>
          )
        ),
        blockquote: ({ node, ...props }) => (
          <Box sx={{ 
            borderLeft: 4, 
            borderColor: 'primary.main', 
            pl: 2,
            py: 0.5,
            my: 2,
            bgcolor: 'grey.50',
            color: 'text.secondary',
          }} {...props} />
        ),
        a: ({ node, ...props }) => (
          <Link {...props} color="primary" underline="hover" target="_blank" rel="noopener noreferrer" />
        ),
        hr: ({ node, ...props }) => (
          <Divider sx={{ my: 3 }} {...props} />
        ),
        table: ({ node, ...props }) => (
          <Box sx={{ overflowX: 'auto', my: 2 }}>
            <Box component="table" sx={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              '& th, & td': {
                border: 1,
                borderColor: 'divider',
                p: 1,
                textAlign: 'left',
              },
              '& th': {
                bgcolor: 'grey.100',
                fontWeight: 600,
              },
            }} {...props} />
          </Box>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
