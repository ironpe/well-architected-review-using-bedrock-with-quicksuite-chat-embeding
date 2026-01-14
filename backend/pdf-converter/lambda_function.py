"""
PDF to Image Converter Lambda Function
Uses PyMuPDF to convert PDF pages to PNG images
"""

import json
import boto3
import fitz  # PyMuPDF
import base64
from io import BytesIO

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    """
    Convert a PDF page to PNG image
    
    Input Option 1 (S3):
        {
            "s3Bucket": "bucket-name",
            "s3Key": "path/to/file.pdf",
            "pageNumber": 1,
            "dpi": 150
        }
    
    Input Option 2 (Base64):
        {
            "pdfBase64": "base64-encoded-pdf",
            "pageNumber": 1,
            "dpi": 150
        }
    
    Output:
        {
            "imageBase64": "base64-encoded-png",
            "width": 1024,
            "height": 768,
            "size": 123456
        }
    """
    try:
        # Parse input
        page_number = event.get('pageNumber', 1)
        dpi = event.get('dpi', 150)
        
        # Get PDF bytes
        if 's3Bucket' in event and 's3Key' in event:
            # Download from S3
            s3_bucket = event['s3Bucket']
            s3_key = event['s3Key']
            print(f"Downloading PDF: s3://{s3_bucket}/{s3_key}")
            
            response = s3_client.get_object(Bucket=s3_bucket, Key=s3_key)
            pdf_bytes = response['Body'].read()
            print(f"Downloaded: {len(pdf_bytes)} bytes")
        elif 'pdfBase64' in event:
            # Decode base64
            print(f"Decoding base64 PDF...")
            pdf_bytes = base64.b64decode(event['pdfBase64'])
            print(f"Decoded: {len(pdf_bytes)} bytes")
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 's3Bucket+s3Key or pdfBase64 is required'})
            }
        
        print(f"Converting page {page_number} at {dpi} DPI...")
        
        # Open PDF with PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Validate page number
        if page_number < 1 or page_number > len(doc):
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': f'Invalid page number: {page_number}. PDF has {len(doc)} pages.'
                })
            }
        
        # Get page (0-based index)
        page = doc[page_number - 1]
        
        # Calculate zoom factor for desired DPI
        # Default PDF DPI is 72, so zoom = target_dpi / 72
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)
        
        # Render page to pixmap
        pix = page.get_pixmap(matrix=mat, alpha=False)
        
        # Convert to PNG bytes
        png_bytes = pix.tobytes("png")
        
        # Encode to base64
        image_base64 = base64.b64encode(png_bytes).decode('utf-8')
        
        # Close document
        doc.close()
        
        print(f"✅ Converted: {pix.width}x{pix.height} pixels, {len(png_bytes)} bytes")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'imageBase64': image_base64,
                'width': pix.width,
                'height': pix.height,
                'size': len(png_bytes),
                'pageNumber': page_number,
                'dpi': dpi
            })
        }
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'type': type(e).__name__
            })
        }
