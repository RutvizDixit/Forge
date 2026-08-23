from .builder import ExportBuilder
from .pdf_layout import export_pdf_fitted

# Keep the existing export API intact; only replace the PDF layout implementation.
ExportBuilder._export_pdf = export_pdf_fitted

__all__ = ["ExportBuilder"]
