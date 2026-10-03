import sys

def create_pdf(filename, title, patient_name, date, results, notes):
    content_lines = []
    content_lines.append("BT")
    content_lines.append("/F1 16 Tf")
    content_lines.append("50 740 Td")
    content_lines.append(f"({title}) Tj")
    content_lines.append("0 -22 Td")
    content_lines.append("/F1 11 Tf")
    content_lines.append(f"(MEDIVRA ADVANCED CLINICAL DIAGNOSTICS LABORATORY) Tj")
    content_lines.append("0 -18 Td")
    content_lines.append("/F2 9 Tf")
    content_lines.append(f"(Patient Name: {patient_name}    Date: {date}    Sample ID: LAB-{hash(date)%100000:05d}) Tj")
    content_lines.append("0 -14 Td")
    content_lines.append(f"(Age/Gender: 45 Y / Male          Referred By: Dr. Rajesh Sharma) Tj")
    content_lines.append("0 -24 Td")
    
    content_lines.append("/F1 11 Tf")
    content_lines.append("(LIPID PROFILE / CHOLESTEROL PANEL) Tj")
    content_lines.append("0 -16 Td")
    
    content_lines.append("/F1 9 Tf")
    content_lines.append("(TEST PARAMETER              RESULT    UNIT     REFERENCE INTERVAL   STATUS) Tj")
    content_lines.append("0 -14 Td")
    content_lines.append("/F2 9 Tf")
    
    for param, val, unit, ref_range, flag in results:
        flag_str = f"[{flag}]" if flag != "NORMAL" else "NORMAL"
        row_str = f"{param:<26} {val:<9} {unit:<8} {ref_range:<20} {flag_str}"
        content_lines.append(f"({row_str}) Tj")
        content_lines.append("0 -14 Td")
        
    content_lines.append("0 -18 Td")
    content_lines.append("/F1 10 Tf")
    content_lines.append("(CLINICAL IMPRESSION & INTERPRETATION:) Tj")
    content_lines.append("0 -14 Td")
    content_lines.append("/F2 8.5 Tf")
    for note in notes:
        content_lines.append(f"({note}) Tj")
        content_lines.append("0 -12 Td")
        
    content_lines.append("0 -22 Td")
    content_lines.append("/F2 8 Tf")
    content_lines.append("(Verified by: Dr. A. K. Verma, MD Pathology - Medivra Diagnostics) Tj")
    content_lines.append("ET")
    
    stream_content = "\n".join(content_lines).encode("latin-1")
    stream_len = len(stream_content)
    
    objects = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objects.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>")
    objects.append(f"<< /Length {stream_len} >>\nstream\n".encode("latin-1") + stream_content + b"\nendstream")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")
    
    with open(filename, "wb") as f:
        f.write(b"%PDF-1.4\n")
        xref_offsets = []
        for i, obj in enumerate(objects, 1):
            xref_offsets.append(f.tell())
            f.write(f"{i} 0 obj\n".encode("latin-1"))
            f.write(obj)
            f.write(b"\nendobj\n")
            
        xref_start = f.tell()
        f.write(b"xref\n")
        f.write(f"0 {len(objects)+1}\n".encode("latin-1"))
        f.write(b"0000000000 65535 f \n")
        for offset in xref_offsets:
            f.write(f"{offset:010d} 00000 n \n".encode("latin-1"))
            
        f.write(b"trailer\n")
        f.write(f"<< /Size {len(objects)+1} /Root 1 0 R >>\n".encode("latin-1"))
        f.write(b"startxref\n")
        f.write(f"{xref_start}\n".encode("latin-1"))
        f.write(b"%%EOF\n")

if __name__ == "__main__":
    results_baseline = [
        ("Total Cholesterol", "248", "mg/dL", "< 200 mg/dL", "HIGH"),
        ("Triglycerides", "210", "mg/dL", "< 150 mg/dL", "HIGH"),
        ("HDL Cholesterol", "38", "mg/dL", "> 40 mg/dL", "LOW"),
        ("LDL Cholesterol", "168", "mg/dL", "< 100 mg/dL", "HIGH"),
        ("VLDL Cholesterol", "42", "mg/dL", "< 30 mg/dL", "HIGH"),
        ("Chol / HDL Ratio", "6.5", "ratio", "< 5.0", "HIGH"),
    ]
    notes_baseline = [
        "- Elevated Total Cholesterol and LDL-C levels indicate moderate-to-high atherogenic risk.",
        "- Elevated Triglycerides and low HDL indicate combined dyslipidemia.",
        "- Recommendation: Lifestyle modification, dietary lipid control, and physician consultation."
    ]
    create_pdf("/Users/bharattanwar/Downloads/medivra/Lipid_Panel_Baseline_Report.pdf", 
               "MEDIVRA HEALTHCARE - DIAGNOSTIC REPORT", 
               "Test Patient", "2026-08-15", results_baseline, notes_baseline)

    results_followup = [
        ("Total Cholesterol", "185", "mg/dL", "< 200 mg/dL", "NORMAL"),
        ("Triglycerides", "138", "mg/dL", "< 150 mg/dL", "NORMAL"),
        ("HDL Cholesterol", "46", "mg/dL", "> 40 mg/dL", "NORMAL"),
        ("LDL Cholesterol", "111", "mg/dL", "< 100 mg/dL", "NORMAL"),
        ("VLDL Cholesterol", "28", "mg/dL", "< 30 mg/dL", "NORMAL"),
        ("Chol / HDL Ratio", "4.0", "ratio", "< 5.0", "NORMAL"),
    ]
    notes_followup = [
        "- Remarkable clinical recovery: Total Cholesterol decreased from 248 to 185 mg/dL (normalized).",
        "- Triglycerides normalized (< 150 mg/dL) and HDL improved to protective levels (46 mg/dL).",
        "- Favorable response to current therapeutic regimen and lifestyle adherence."
    ]
    create_pdf("/Users/bharattanwar/Downloads/medivra/Lipid_Panel_Followup_Report.pdf", 
               "MEDIVRA HEALTHCARE - DIAGNOSTIC REPORT", 
               "Test Patient", "2026-09-28", results_followup, notes_followup)
    print("SUCCESS: Generated Lipid_Panel_Baseline_Report.pdf and Lipid_Panel_Followup_Report.pdf")
