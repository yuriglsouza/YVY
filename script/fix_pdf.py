import re
import sys

def replace_pdf_code():
    file_path = "/Users/yuri/Desktop/Backup/Code-Robustness/client/src/pages/FarmDetails.tsx"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # The region starts at:
    # "  // PDF Generation Logic - Strict 2 Pages Enterprise SaaS\n  const handleDownloadPDF"
    # And ends with "    }\n  };" right before: "  return (\n    <div className=\"flex min-h-screen\">"

    pattern = r"(\s+// PDF Generation Logic - Strict 2 Pages Enterprise SaaS\s+const handleDownloadPDF = async \(reportContent: string, date: string, config\?: ReportConfig\) => \{)([\s\S]*?)(^\s+\};\s+return \(\s+<div className=\"flex min-h-screen\">)"
    
    match = re.search(pattern, content, re.MULTILINE)
    if not match:
        print("Pattern not found!")
        return

    new_code = """
  // PDF Generation Logic - Strict 2 Pages Enterprise SaaS
  const handleDownloadPDF = async (reportContent: string, date: string, config?: ReportConfig) => {
    try {
      if (!reportRef.current) throw new Error("Template de relatório não encontrado no DOM");
      
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });
      
      // Print notification
      toast({ title: "Iniciando captura", description: "O motor está renderizando os gráficos em alta definição..." });

      // Capture Page HTML Engine
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // High resolution (retina alike)
        useCORS: true, 
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      
      const pdfWidth = doc.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdfHeight = doc.internal.pageSize.getHeight();
      
      // First page
      doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
      
      // Page 2 (Maps + Recharts Engine) -> Shift Y negatively by exactly 1 page height to show second page
      doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, -pdfHeight, pdfWidth, imgHeight);
      
      doc.save(`SYAZ_Report_Auditoria_${farm?.name || "Fazenda"}_${format(new Date(), "dd-MM-yyyy")}.pdf`);
      toast({ title: "Relatório de Auditoria Exportado", description: "O laudo contendo Inteligência Artificial e Biometria visual foi salvo." });
    } catch (error: any) {
      console.error("PDF Generation Error:", error);
      toast({
        title: "Erro fatal no Gerador de PDF",
        description: error.message || String(error),
        variant: "destructive"
      });
    }
  };
"""

    new_content = content[:match.start(1)] + new_code + content[match.start(3):]
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    
    print("Done replacing large PDF block.")

if __name__ == "__main__":
    replace_pdf_code()
