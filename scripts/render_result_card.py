import os
from PIL import Image, ImageDraw, ImageFont

def render_comprehensive_marks_card():
    # Standard high-resolution A4 proportions: 1800 x 2540
    W, H = 1800, 2540
    img = Image.new('RGB', (W, H), color='#ffffff')
    draw = ImageDraw.Draw(img)

    # Brand Colors from logo
    BRAND_BLUE = '#004aad'      # Royal Cambridge Blue from logo
    DEEP_NAVY = '#1b1a47'       # Dark Cambridge Navy
    GOLD_ACCENT = '#c8952b'     # Antique Gold
    TEXT_DARK = '#0f172a'       # Slate 900
    TEXT_MUTED = '#64748b'      # Slate 500
    BORDER_LIGHT = '#cbd5e1'    # Slate 300
    ROW_BG_ALT = '#f8fafc'      # Slate 50
    ROW_BG_WHITE = '#ffffff'
    PASS_GREEN = '#059669'      # Emerald 600

    # Fonts
    font_dir = r"C:\Windows\Fonts"
    f_serif_bold = os.path.join(font_dir, "georgiab.ttf")
    f_serif = os.path.join(font_dir, "georgia.ttf")
    f_sans_bold = os.path.join(font_dir, "arialbd.ttf")
    f_sans = os.path.join(font_dir, "arial.ttf")

    font_title = ImageFont.truetype(f_serif_bold, 54)
    font_subtitle = ImageFont.truetype(f_sans_bold, 28)
    font_sub_info = ImageFont.truetype(f_sans, 21)
    font_tbl_hdr = ImageFont.truetype(f_sans_bold, 19)
    font_cell = ImageFont.truetype(f_sans, 21)
    font_cell_bold = ImageFont.truetype(f_sans_bold, 21)
    font_badge = ImageFont.truetype(f_sans_bold, 18)
    font_sm = ImageFont.truetype(f_sans, 18)
    font_sig = ImageFont.truetype(f_serif, 24)

    # 1. Double Border
    draw.rectangle([35, 35, W - 35, H - 35], outline=BRAND_BLUE, width=4)
    draw.rectangle([45, 45, W - 45, H - 45], outline=GOLD_ACCENT, width=2)

    # 2. Header with Real School Logo
    logo_path = 'logowb.png'
    y = 65
    if os.path.exists(logo_path):
        logo_im = Image.open(logo_path).convert('RGBA')
        bbox = logo_im.getbbox()
        if bbox:
            logo_im = logo_im.crop(bbox)
        logo_w, logo_h = 180, 180
        logo_im.thumbnail((logo_w, logo_h), Image.Resampling.LANCZOS)
        logo_x = (W - logo_im.width) // 2
        img.paste(logo_im, (logo_x, y), logo_im)
        y += logo_im.height + 18
    else:
        y += 85

    # School Name in Royal Cambridge Blue (#004aad)
    title_text = "CAMBRIDGE EDUCATION SYSTEM"
    title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
    draw.text(((W - (title_bbox[2] - title_bbox[0])) // 2, y), title_text, fill=BRAND_BLUE, font=font_title)
    y += 65

    # Subtitle
    sub_text = "ANNUAL ACADEMIC EVALUATION & RESULT CARD"
    sub_bbox = draw.textbbox((0, 0), sub_text, font=font_subtitle)
    draw.text(((W - (sub_bbox[2] - sub_bbox[0])) // 2, y), sub_text, fill=DEEP_NAVY, font=font_subtitle)
    y += 38

    # Session & Affiliation
    aff_text = "Academic Session: 2026–2027  •  Official Student Evaluation Transcript"
    aff_bbox = draw.textbbox((0, 0), aff_text, font=font_sub_info)
    draw.text(((W - (aff_bbox[2] - aff_bbox[0])) // 2, y), aff_text, fill=TEXT_MUTED, font=font_sub_info)
    y += 36

    # Gold Accent Line
    draw.rectangle([100, y, W - 100, y + 3], fill=GOLD_ACCENT)
    y += 28

    # 3. Student Profile Card
    card_x, card_w = 90, W - 180
    card_h = 160
    draw.rounded_rectangle([card_x, y, card_x + card_w, y + card_h], radius=12, fill='#f8fafc', outline=BORDER_LIGHT, width=2)
    draw.rounded_rectangle([card_x, y, card_x + 8, y + card_h], radius=4, fill=BRAND_BLUE)

    row1_y = y + 25
    row2_y = y + 90

    col1_x = card_x + 35
    col2_x = card_x + 460
    col3_x = card_x + 880
    col4_x = card_x + 1280

    fields = [
        ("STUDENT NAME", "Bella Chen", col1_x, row1_y, True),
        ("ADMISSION NO", "ADM-5019", col2_x, row1_y, False),
        ("ROLL NUMBER", "S-002", col3_x, row1_y, False),
        ("CLASS & SECTION", "Class 5 - Cambridge Primary", col4_x, row1_y, True),
        
        ("DATE OF BIRTH", "18 May 2013", col1_x, row2_y, False),
        ("EXAMINATION", "Annual Final Assessment 2026", col2_x, row2_y, False),
        ("OVERALL RESULT", "PASSED • PROMOTED TO CLASS 6", col3_x, row2_y, True, PASS_GREEN),
        ("DATE OF ISSUE", "18 November 2026", col4_x, row2_y, False)
    ]

    for item in fields:
        label = item[0]
        val = item[1]
        fx = item[2]
        fy = item[3]
        is_bold = item[4]
        color = item[5] if len(item) > 5 else TEXT_DARK

        draw.text((fx, fy), label, fill=TEXT_MUTED, font=font_badge)
        draw.text((fx, fy + 26), val, fill=color, font=font_cell_bold if is_bold else font_cell)

    y += card_h + 30

    # 4. Comprehensive Subject Assessment Table with MARKS for ALL categories:
    # Monthly Tests, Assignments, Mid-Term, Terminal Exam, Total Marks, Grade, Status
    table_x = 90
    table_w = W - 180
    headers = [
        ("#", 55, 'C'),
        ("SUBJECT", 385, 'L'),
        ("MONTHLY\nTESTS (15)", 180, 'C'),
        ("TASKS &\nASSIGN (10)", 180, 'C'),
        ("MID-TERM\nEXAM (25)", 180, 'C'),
        ("TERMINAL\nEXAM (50)", 180, 'C'),
        ("TOTAL MARKS\nOBTAINED (100)", 220, 'C'),
        ("GRADE", 110, 'C'),
        ("STATUS", 130, 'C')
    ]

    header_h = 70
    draw.rectangle([table_x, y, table_x + table_w, y + header_h], fill=BRAND_BLUE)
    draw.rectangle([table_x, y + header_h - 3, table_x + table_w, y + header_h], fill=GOLD_ACCENT)

    cur_x = table_x
    for name, w_col, align in headers:
        lines = name.split('\n')
        total_text_h = len(lines) * 20
        start_ty = y + (header_h - total_text_h) // 2
        for l_idx, line in enumerate(lines):
            t_bbox = draw.textbbox((0, 0), line, font=font_tbl_hdr)
            tw = t_bbox[2] - t_bbox[0]
            if align == 'C':
                tx = cur_x + (w_col - tw) // 2
            elif align == 'R':
                tx = cur_x + w_col - tw - 16
            else:
                tx = cur_x + 18
            draw.text((tx, start_ty + l_idx * 20), line, fill='#ffffff', font=font_tbl_hdr)
        cur_x += w_col

    y += header_h

    # Subject Rows: Actual Marks out of allocated marks for each category
    # Columns: #, Subject, Monthly(15), Tasks(10), Mid-Term(25), Terminal(50), Total(100), Grade, Status
    rows = [
        ("1", "Mathematics", "12 / 15", "9 / 10", "20 / 25", "37 / 50", "78 / 100", "B", "Passed"),
        ("2", "English Language", "12 / 15", "9 / 10", "21 / 25", "36 / 50", "78 / 100", "B", "Passed"),
        ("3", "General Science", "13 / 15", "9 / 10", "23 / 25", "42 / 50", "87 / 100", "A", "Passed"),
        ("4", "Social Studies & History", "12 / 15", "9 / 10", "20 / 25", "35 / 50", "76 / 100", "B", "Passed"),
        ("5", "Computer Studies", "14 / 15", "10 / 10", "23 / 25", "44 / 50", "91 / 100", "A*", "Passed"),
        ("6", "Urdu Literature", "11 / 15", "8 / 10", "19 / 25", "34 / 50", "72 / 100", "B", "Passed"),
        ("7", "Islamic / Moral Studies", "14 / 15", "10 / 10", "24 / 25", "43 / 50", "91 / 100", "A*", "Passed")
    ]

    row_h = 62
    for idx, r in enumerate(rows):
        bg_col = ROW_BG_WHITE if idx % 2 == 0 else ROW_BG_ALT
        draw.rectangle([table_x, y, table_x + table_w, y + row_h], fill=bg_col)
        draw.line([table_x, y + row_h, table_x + table_w, y + row_h], fill=BORDER_LIGHT, width=1)

        cur_x = table_x
        for c_idx, cell in enumerate(r):
            w_col = headers[c_idx][1]
            align = headers[c_idx][2]
            f_use = font_cell_bold if c_idx in [1, 6, 7] else font_cell
            color = TEXT_DARK

            if c_idx == 6: # Total Marks column
                color = BRAND_BLUE
            elif c_idx == 7: # Grade
                color = PASS_GREEN if cell in ['A*', 'A'] else '#1d4ed8'
            elif c_idx == 8: # Status
                color = PASS_GREEN

            t_bbox = draw.textbbox((0, 0), cell, font=f_use)
            tw = t_bbox[2] - t_bbox[0]
            th = t_bbox[3] - t_bbox[1]
            ty = y + (row_h - th) // 2

            if align == 'C':
                tx = cur_x + (w_col - tw) // 2
            elif align == 'R':
                tx = cur_x + w_col - tw - 16
            else:
                tx = cur_x + 18

            # Grade badge background
            if c_idx == 7:
                badge_w = 48
                bx = cur_x + (w_col - badge_w) // 2
                draw.rounded_rectangle([bx, y + 10, bx + badge_w, y + row_h - 10], radius=6, fill='#ecfdf5' if cell in ['A*', 'A'] else '#eff6ff')
                draw.text((tx, ty), cell, fill=color, font=f_use)
            else:
                draw.text((tx, ty), cell, fill=color, font=f_use)

            cur_x += w_col

        y += row_h

    # Table Summary Total Row (Sum of Marks)
    foot_h = 64
    draw.rectangle([table_x, y, table_x + table_w, y + foot_h], fill='#f1f5f9')
    draw.rectangle([table_x, y, table_x + table_w, y + 3], fill=BRAND_BLUE)
    draw.line([table_x, y + foot_h, table_x + table_w, y + foot_h], fill=BORDER_LIGHT, width=1)

    cur_x = table_x
    totals = [
        "", "TOTAL AGGREGATE", "88 / 105", "64 / 70", "150 / 175", "271 / 350", "573 / 700", "A", "PASSED"
    ]
    for c_idx, cell in enumerate(totals):
        w_col = headers[c_idx][1]
        align = headers[c_idx][2]
        f_use = ImageFont.truetype(f_sans_bold, 22) if c_idx == 6 else font_cell_bold
        color = BRAND_BLUE if c_idx in [1, 6] else PASS_GREEN if c_idx in [7, 8] else TEXT_DARK

        t_bbox = draw.textbbox((0, 0), cell, font=f_use)
        tw = t_bbox[2] - t_bbox[0]
        th = t_bbox[3] - t_bbox[1]
        ty = y + (foot_h - th) // 2

        if align == 'C':
            tx = cur_x + (w_col - tw) // 2
        elif align == 'R':
            tx = cur_x + w_col - tw - 16
        else:
            tx = cur_x + 18

        draw.text((tx, ty), cell, fill=color, font=f_use)
        cur_x += w_col

    y += foot_h + 30

    # 5. Grand Summary Box (Total Marks Obtained & Overall Percentage displayed clearly below)
    sum_box_w = W - 180
    sum_box_h = 100
    draw.rounded_rectangle([card_x, y, card_x + sum_box_w, y + sum_box_h], radius=14, fill='#f0fdf4', outline='#bbf7d0', width=2)

    s_col1 = card_x + 40
    s_col2 = card_x + 440
    s_col3 = card_x + 850
    s_col4 = card_x + 1280

    # Total Marks: 573 / 700
    draw.text((s_col1, y + 18), "TOTAL MARKS OBTAINED", fill=TEXT_MUTED, font=font_badge)
    draw.text((s_col1, y + 46), "573 / 700", fill=BRAND_BLUE, font=ImageFont.truetype(f_sans_bold, 30))

    # Overall Percentage: 81.86%
    draw.text((s_col2, y + 18), "OVERALL PERCENTAGE", fill=TEXT_MUTED, font=font_badge)
    draw.text((s_col2, y + 46), "81.86%", fill=BRAND_BLUE, font=ImageFont.truetype(f_sans_bold, 30))

    # Overall Grade: Grade A
    draw.text((s_col3, y + 18), "FINAL ACADEMIC GRADE", fill=TEXT_MUTED, font=font_badge)
    draw.text((s_col3, y + 46), "Grade A (Distinction)", fill=PASS_GREEN, font=ImageFont.truetype(f_sans_bold, 28))

    # Promotion Decision
    draw.text((s_col4, y + 18), "BOARD DECISION", fill=TEXT_MUTED, font=font_badge)
    draw.text((s_col4, y + 46), "Promoted to Class 6", fill=PASS_GREEN, font=ImageFont.truetype(f_sans_bold, 26))

    y += sum_box_h + 35

    # 6. Cambridge International Grading Reference
    scale_h = 66
    draw.rounded_rectangle([card_x, y, card_x + sum_box_w, y + scale_h], radius=10, fill='#ffffff', outline=BORDER_LIGHT, width=1)
    draw.text((card_x + 20, y + 10), "CAMBRIDGE INTERNATIONAL GRADING THRESHOLDS:", fill=DEEP_NAVY, font=font_badge)

    scales = [
        ("A* (90-100%)", "#059669"),
        ("A (80-89%)", "#059669"),
        ("B (70-79%)", "#1d4ed8"),
        ("C (60-69%)", "#2563eb"),
        ("D (50-59%)", "#d97706"),
        ("E (40-49%)", "#ea580c"),
        ("U (< 40% Fail)", "#dc2626")
    ]
    cur_sx = card_x + 20
    for s_name, s_col in scales:
        draw.text((cur_sx, y + 35), s_name, fill=s_col, font=font_sm)
        cur_sx += 230

    y += scale_h + 70

    # 7. Institutional Signatures & Official Stamp
    sig_y = y + 80
    # Left: Class Teacher
    draw.line([140, sig_y, 460, sig_y], fill=TEXT_DARK, width=2)
    draw.text((210, sig_y + 14), "Class Teacher Signature", fill=TEXT_MUTED, font=font_cell)
    draw.text((230, sig_y - 48), "Sarah Jenkins", fill='#0f172a', font=font_sig)

    # Right: Principal
    draw.line([W - 460, sig_y, W - 140, sig_y], fill=TEXT_DARK, width=2)
    draw.text((W - 420, sig_y + 14), "Principal & Head of School", fill=TEXT_MUTED, font=font_cell)
    draw.text((W - 400, sig_y - 48), "Prof. Tariq Mahmood", fill='#0f172a', font=font_sig)

    # Center: Embossed Official Circular Seal
    seal_cx = W // 2
    seal_cy = sig_y - 15
    seal_r = 75
    draw.ellipse([seal_cx - seal_r, seal_cy - seal_r, seal_cx + seal_r, seal_cy + seal_r], outline=GOLD_ACCENT, width=4)
    draw.ellipse([seal_cx - seal_r + 6, seal_cy - seal_r + 6, seal_cx + seal_r - 6, seal_cy + seal_r - 6], outline=BRAND_BLUE, width=2)
    draw.ellipse([seal_cx - seal_r + 10, seal_cy - seal_r + 10, seal_cx + seal_r - 10, seal_cy + seal_r - 10], fill='#fdfbf7')

    draw.text((seal_cx - 45, seal_cy - 40), "CAMBRIDGE", fill=BRAND_BLUE, font=font_badge)
    draw.text((seal_cx - 40, seal_cy - 18), "EDUCATION", fill=BRAND_BLUE, font=font_badge)
    draw.text((seal_cx - 30, seal_cy + 4), "★ SYSTEM ★", fill=GOLD_ACCENT, font=font_badge)
    draw.text((seal_cx - 42, seal_cy + 25), "VERIFIED", fill='#059669', font=font_badge)

    # Save to artifacts directory and docs
    out_artifact = r"C:\Users\Ansari\.gemini\antigravity\brain\4ff5126a-2c28-460b-9c8f-e4dd85fa67bb\cambridge_comprehensive_result_card.png"
    out_docs = r"docs\cambridge_comprehensive_result_card.png"

    img.save(out_artifact, quality=95)
    img.save(out_docs, quality=95)
    print("SUCCESS: Comprehensive marks card generated at:", out_artifact)
    print("SUCCESS: Comprehensive marks card generated at:", out_docs)

if __name__ == '__main__':
    render_comprehensive_marks_card()
