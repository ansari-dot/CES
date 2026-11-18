import os
from PIL import Image, ImageDraw, ImageFont

def render_official_card():
    # Dimensions: 1800 x 2540 (High-resolution 300dpi A4 proportion)
    W, H = 1800, 2540
    img = Image.new('RGB', (W, H), color='#ffffff')
    draw = ImageDraw.Draw(img)

    # Palette
    BRAND_BLUE = '#004aad'      # School Primary Royal Cobalt Blue from logo
    DEEP_NAVY = '#1b1a47'       # Dark Cambridge Navy
    GOLD_ACCENT = '#c8952b'     # School Cambridge Gold
    VIBRANT_GOLD = '#ffc53a'    # Logo Gold accent
    TEXT_DARK = '#1e293b'       # Slate 900
    TEXT_MUTED = '#64748b'      # Slate 500
    BORDER_LIGHT = '#e2e8f0'    # Slate 200
    ROW_BG_ALT = '#f8fafc'      # Slate 50
    ROW_BG_WHITE = '#ffffff'
    PASS_GREEN = '#059669'      # Emerald 600

    # Fonts
    font_dir = r"C:\Windows\Fonts"
    f_serif_bold = os.path.join(font_dir, "georgiab.ttf")
    f_serif = os.path.join(font_dir, "georgia.ttf")
    f_sans_bold = os.path.join(font_dir, "arialbd.ttf")
    f_sans = os.path.join(font_dir, "arial.ttf")

    font_title = ImageFont.truetype(f_serif_bold, 52)
    font_subtitle = ImageFont.truetype(f_sans_bold, 24)
    font_sub_info = ImageFont.truetype(f_sans, 20)
    font_section = ImageFont.truetype(f_sans_bold, 22)
    font_cell = ImageFont.truetype(f_sans, 20)
    font_cell_bold = ImageFont.truetype(f_sans_bold, 20)
    font_badge = ImageFont.truetype(f_sans_bold, 18)
    font_sm = ImageFont.truetype(f_sans, 17)
    font_sig = ImageFont.truetype(f_serif, 24)

    # 1. Elegant Double Border with Gold and Navy
    draw.rectangle([30, 30, W - 30, H - 30], outline=BRAND_BLUE, width=5)
    draw.rectangle([42, 42, W - 42, H - 42], outline=GOLD_ACCENT, width=2)
    draw.rectangle([48, 48, W - 48, H - 48], outline=BRAND_BLUE, width=1)

    # Corner Ornaments (Gold corner squares)
    corners = [(30, 30), (W - 55, 30), (30, H - 55), (W - 55, H - 55)]
    for cx, cy in corners:
        draw.rectangle([cx, cy, cx + 25, cy + 25], fill=GOLD_ACCENT)

    # 2. Header with Real School Logo
    logo_path = 'logowb.png'
    y = 75
    if os.path.exists(logo_path):
        logo_im = Image.open(logo_path).convert('RGBA')
        bbox = logo_im.getbbox()
        if bbox:
            logo_im = logo_im.crop(bbox)
        logo_w, logo_h = 170, 170
        logo_im.thumbnail((logo_w, logo_h), Image.Resampling.LANCZOS)
        logo_x = (W - logo_im.width) // 2
        img.paste(logo_im, (logo_x, y), logo_im)
        y += logo_im.height + 25
    else:
        y += 80

    # School Name in Royal Cambridge Blue (#004aad)
    title_text = "CAMBRIDGE EDUCATION SYSTEM"
    title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
    draw.text(((W - (title_bbox[2] - title_bbox[0])) // 2, y), title_text, fill=BRAND_BLUE, font=font_title)
    y += 65

    # Subtitle
    sub_text = "OFFICIAL TERMINAL EXAMINATION & ANNUAL ACADEMIC TRANSCRIPT"
    sub_bbox = draw.textbbox((0, 0), sub_text, font=font_subtitle)
    draw.text(((W - (sub_bbox[2] - sub_bbox[0])) // 2, y), sub_text, fill=DEEP_NAVY, font=font_subtitle)
    y += 35

    # Accreditation / Session line
    aff_text = "Affiliated with Cambridge Assessment International Education • Academic Session 2026–2027"
    aff_bbox = draw.textbbox((0, 0), aff_text, font=font_sub_info)
    draw.text(((W - (aff_bbox[2] - aff_bbox[0])) // 2, y), aff_text, fill=TEXT_MUTED, font=font_sub_info)
    y += 35

    # Gold Divider Bar
    draw.rectangle([120, y, W - 120, y + 3], fill=GOLD_ACCENT)
    y += 25

    # 3. Student Profile Card
    card_x, card_w = 90, W - 180
    card_h = 175
    draw.rounded_rectangle([card_x, y, card_x + card_w, y + card_h], radius=16, fill='#f8fafc', outline=BORDER_LIGHT, width=2)
    # Left accent vertical strip in Brand Blue
    draw.rounded_rectangle([card_x, y, card_x + 10, y + card_h], radius=5, fill=BRAND_BLUE)

    # Profile Details (4 columns x 2 rows)
    row1_y = y + 25
    row2_y = y + 100

    col1_x = card_x + 35
    col2_x = card_x + 440
    col3_x = card_x + 850
    col4_x = card_x + 1280

    fields = [
        ("STUDENT NAME", "Bella Chen", col1_x, row1_y, True),
        ("ADMISSION NO", "ADM-5019", col2_x, row1_y, False),
        ("ROLL NUMBER", "S-002", col3_x, row1_y, False),
        ("CLASS & SECTION", "Class 5 - Cambridge Primary", col4_x, row1_y, True),
        
        ("ANNUAL PERCENTAGE", "81.62%", col1_x, row2_y, True, BRAND_BLUE),
        ("CAMBRIDGE GRADE", "Grade A (Distinction)", col2_x, row2_y, True, PASS_GREEN),
        ("PROMOTION STATUS", "PASSED • PROMOTED TO CLASS 6", col3_x, row2_y, True, PASS_GREEN),
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

    y += card_h + 35

    # 4. Policy Notice Ribbon
    notice_text = "OFFICIAL 4-CATEGORY WEIGHTED POLICY: Mid-Term Exam (25%)  •  Monthly Tests (15%)  •  Tasks & Assignments (10%)  •  Terminal Exam (50%)"
    notice_bbox = draw.textbbox((0, 0), notice_text, font=font_badge)
    notice_box_w = notice_bbox[2] - notice_bbox[0] + 40
    draw.rounded_rectangle([(W - notice_box_w) // 2, y, (W + notice_box_w) // 2, y + 36], radius=8, fill='#eef4ff', outline='#c7d9fe', width=1)
    draw.text(((W - (notice_bbox[2] - notice_bbox[0])) // 2, y + 8), notice_text, fill=BRAND_BLUE, font=font_badge)
    y += 55

    # 5. Main Subject Assessment Table
    table_x = 90
    table_w = W - 180
    row_h = 58
    headers = [
        ("#", 50, 'C'),
        ("SUBJECT", 330, 'L'),
        ("TEACHER", 250, 'L'),
        ("MID-TERM\n(25%)", 150, 'C'),
        ("MONTHLY\n(15%)", 150, 'C'),
        ("TASKS\n(10%)", 150, 'C'),
        ("TERMINAL\n(50%)", 150, 'C'),
        ("ANNUAL %\n(100%)", 160, 'C'),
        ("GRADE", 100, 'C'),
        ("STATUS", 130, 'C')
    ]

    header_h = 68
    draw.rectangle([table_x, y, table_x + table_w, y + header_h], fill=BRAND_BLUE)
    # Header bottom gold highlight
    draw.rectangle([table_x, y + header_h - 3, table_x + table_w, y + header_h], fill=GOLD_ACCENT)

    cur_x = table_x
    for name, w_col, align in headers:
        lines = name.split('\n')
        total_text_h = len(lines) * 20
        start_ty = y + (header_h - total_text_h) // 2
        for l_idx, line in enumerate(lines):
            t_bbox = draw.textbbox((0, 0), line, font=font_badge)
            tw = t_bbox[2] - t_bbox[0]
            if align == 'C':
                tx = cur_x + (w_col - tw) // 2
            elif align == 'R':
                tx = cur_x + w_col - tw - 12
            else:
                tx = cur_x + 16
            draw.text((tx, start_ty + l_idx * 20), line, fill='#ffffff', font=font_badge)
        cur_x += w_col

    y += header_h

    # Table Subject Rows
    rows_data = [
        ("1", "Mathematics", "Mr. Arsalan Saleem", "80.0%", "82.0%", "90.0%", "74.0%", "78.50%", "B", "PASSED"),
        ("2", "English Language", "Ms. Sarah Jenkins", "84.0%", "78.0%", "85.0%", "72.0%", "77.50%", "B", "PASSED"),
        ("3", "General Science", "Dr. Farooq Ahmed", "90.0%", "88.0%", "90.0%", "84.0%", "87.00%", "A", "PASSED"),
        ("4", "Social Studies & History", "Ms. Hira Naeem", "78.0%", "80.0%", "88.0%", "70.0%", "76.20%", "B", "PASSED"),
        ("5", "Computer Studies", "Engr. Hamza Ali", "92.0%", "90.0%", "95.0%", "88.0%", "90.10%", "A*", "PASSED"),
        ("6", "Urdu Literature", "Mrs. Sadia Khan", "76.0%", "75.0%", "82.0%", "68.0%", "72.25%", "B", "PASSED"),
        ("7", "Islamic Studies", "Qari Abdul Rehman", "94.0%", "92.0%", "95.0%", "86.0%", "89.80%", "A", "PASSED")
    ]

    for idx, r in enumerate(rows_data):
        bg_col = ROW_BG_WHITE if idx % 2 == 0 else ROW_BG_ALT
        draw.rectangle([table_x, y, table_x + table_w, y + row_h], fill=bg_col)
        draw.line([table_x, y + row_h, table_x + table_w, y + row_h], fill=BORDER_LIGHT, width=1)

        # Draw columns
        cur_x = table_x
        for c_idx, cell in enumerate(r):
            w_col = headers[c_idx][1]
            align = headers[c_idx][2]
            f_use = font_cell_bold if c_idx in [1, 7, 8, 9] else font_cell
            color = TEXT_DARK
            if c_idx == 7:
                color = BRAND_BLUE
            elif c_idx == 8:
                color = PASS_GREEN if cell in ['A*', 'A'] else '#2563eb' if cell == 'B' else TEXT_DARK
            elif c_idx == 9:
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
                tx = cur_x + 16

            # Optional badge background for Grade column
            if c_idx == 8:
                badge_w = 44
                bx = cur_x + (w_col - badge_w) // 2
                draw.rounded_rectangle([bx, y + 10, bx + badge_w, y + row_h - 10], radius=6, fill='#ecfdf5' if cell in ['A*', 'A'] else '#eff6ff')
                draw.text((tx, ty), cell, fill=color, font=f_use)
            else:
                draw.text((tx, ty), cell, fill=color, font=f_use)

            cur_x += w_col

        y += row_h

    # Table Grand Total Footer Row
    foot_h = 62
    draw.rectangle([table_x, y, table_x + table_w, y + foot_h], fill='#f1f5f9')
    draw.rectangle([table_x, y, table_x + table_w, y + 2], fill=BRAND_BLUE)
    draw.line([table_x, y + foot_h, table_x + table_w, y + foot_h], fill=BORDER_LIGHT, width=1)

    draw.text((table_x + 20, y + 20), "GRAND ANNUAL AGGREGATE SUMMARY", fill=DEEP_NAVY, font=font_section)
    draw.text((table_x + 850, y + 20), "Max Marks: 700.00", fill=TEXT_MUTED, font=font_cell_bold)
    draw.text((table_x + 1150, y + 18), "Annual Result: 81.62%", fill=BRAND_BLUE, font=ImageFont.truetype(f_sans_bold, 24))
    draw.text((table_x + 1520, y + 18), "GRADE A", fill=PASS_GREEN, font=ImageFont.truetype(f_sans_bold, 24))

    y += foot_h + 35

    # 6. Cambridge Grading Scale Reference Box
    scale_x = 90
    scale_w = W - 180
    scale_h = 75
    draw.rounded_rectangle([scale_x, y, scale_x + scale_w, y + scale_h], radius=10, fill='#ffffff', outline=BORDER_LIGHT, width=1)
    
    scale_title = "CAMBRIDGE ASSESSMENT INTERNATIONAL GRADING THRESHOLDS:"
    draw.text((scale_x + 20, y + 12), scale_title, fill=BRAND_BLUE, font=font_badge)

    scales = [
        ("A* (Distinction)", ">= 90%", "#059669"),
        ("A (Excellent)", "80% - 89%", "#059669"),
        ("B (Very Good)", "70% - 79%", "#2563eb"),
        ("C (Good)", "60% - 69%", "#3b82f6"),
        ("D (Satisfactory)", "50% - 59%", "#d97706"),
        ("E (Pass Threshold)", "40% - 49%", "#ea580c"),
        ("U (Ungraded)", "< 40%", "#dc2626")
    ]

    cur_sx = scale_x + 20
    for s_name, s_range, s_col in scales:
        s_txt = f"{s_name}: {s_range}"
        draw.text((cur_sx, y + 40), s_txt, fill=s_col, font=font_sm)
        cur_sx += 230

    y += scale_h + 60

    # 7. Institutional Signatures & Verification Seal
    sig_y = y + 80
    # Left: Class Teacher
    draw.line([140, sig_y, 440, sig_y], fill=TEXT_DARK, width=2)
    draw.text((190, sig_y + 12), "Class Teacher Signature", fill=TEXT_MUTED, font=font_cell)
    draw.text((215, sig_y - 45), "Sarah Jenkins", fill='#0f172a', font=font_sig)

    # Right: Principal
    draw.line([W - 440, sig_y, W - 140, sig_y], fill=TEXT_DARK, width=2)
    draw.text((W - 410, sig_y + 12), "Principal & Head of School", fill=TEXT_MUTED, font=font_cell)
    draw.text((W - 390, sig_y - 45), "Prof. Tariq Mahmood", fill='#0f172a', font=font_sig)

    # Center: Embossed Official Seal
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
    out_artifact = r"C:\Users\Ansari\.gemini\antigravity\brain\4ff5126a-2c28-460b-9c8f-e4dd85fa67bb\cambridge_official_terminal_result_card.png"
    out_docs = r"docs\cambridge_official_terminal_result_card.png"

    img.save(out_artifact, quality=95)
    img.save(out_docs, quality=95)
    print("SUCCESS: Result card generated at:", out_artifact)
    print("SUCCESS: Result card generated at:", out_docs)

if __name__ == '__main__':
    render_official_card()
