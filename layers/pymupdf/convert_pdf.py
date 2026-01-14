#!/usr/bin/env python3
"""
PDF to Image Converter using PyMuPDF
Converts a single PDF page to PNG image
"""

import sys
import fitz  # PyMuPDF

def convert_pdf_page_to_image(pdf_path: str, page_number: int, output_path: str, dpi: int = 150):
    """
    Convert a single PDF page to PNG image
    
    Args:
        pdf_path: Path to input PDF file
        page_number: Page number to convert (1-based)
        output_path: Path to output PNG file
        dpi: Resolution in DPI (default: 150)
    """
    try:
        # Open PDF
        doc = fitz.open(pdf_path)
        
        # Check page number
        if page_number < 1 or page_number > len(doc):
            raise ValueError(f"Invalid page number: {page_number}. PDF has {len(doc)} pages.")
        
        # Get page (0-based index)
        page = doc[page_number - 1]
        
        # Calculate zoom factor for desired DPI
        # Default PDF DPI is 72, so zoom = target_dpi / 72
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)
        
        # Render page to pixmap
        pix = page.get_pixmap(matrix=mat, alpha=False)
        
        # Save as PNG
        pix.save(output_path)
        
        # Close document
        doc.close()
        
        print(f"✅ Converted page {page_number} to {output_path}")
        print(f"   Size: {pix.width}x{pix.height} pixels")
        
        return 0
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 convert_pdf.py <pdf_path> <page_number> <output_path> [dpi]")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    page_number = int(sys.argv[2])
    output_path = sys.argv[3]
    dpi = int(sys.argv[4]) if len(sys.argv) > 4 else 150
    
    sys.exit(convert_pdf_page_to_image(pdf_path, page_number, output_path, dpi))
