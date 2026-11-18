import os
import math
import random
from PIL import Image, ImageDraw, ImageFont

def draw_qr_code(draw, x, y, size=140):
    # Draw clean realistic QR code
    draw.rectangle([x, y, x + size, y + size], fill='#ffffff', outline='#cbd5e1', width=1)
    modules = 25
    m_size = size / modules
    
    # Deterministic pseudo-random pattern
    rng = random.Random(42)
    grid = [[rng.choice([0, 1]) for _ in range(modules)] for _ in range(modules)]
    
    # Finder patterns at 3 corners (top-left, top-right, bottom-left)
    def add_finder(r_start, c_start):
        for r in range(7):
            for c in range(7):
                if r in [0, 6] or c in [0, 6] or (2 <= r <= 4 and 2 <= c <= 4):
                    grid[r_start + r][c_start + c] = 1
                else:
                    grid[r_start + r][c_start + c] = 0
        # white separator
        for r in range(-1, 8):
            for c in range(-1, 8):
                nr, nc = r_start + r, c_start + c
                if 0 <= nr < modules and 0 <= nc < modules:
                    if r in [-1, 7] or c in [-1, 7]:
                        grid[nr][nc] = 0

    add_finder(0, 0)
    add_finder(0, modules - 7)
    add_finder(modules - 7, 0)

    for r in range(modules):
        for c in range(modules):
            if grid[r][c] == 1:
                mx = x + c * m_size
                my = y + r * m_size
                draw.rectangle([mx, my, mx + m_size, my + m_size], fill='#0f172a')

def render_international_result_card():
    # True A4 at 300 DPI: 2480 x 3508
    W, H = 2480, 3508
    img = Image.new('RGB', (W, H), color='#ffffff')
    draw = ImageDraw.Draw(img)

    # ── PALETTE ─────────────────────────────────────────────────────────────
    BRAND_BLUE = '#004aad'      # Primary Royal Cambridge Cobalt Blue
    DEEP_NAVY = '#0a1931'       # Dark British Academic Navy
    SLATE_TEXT = '#1e293b'      # Body text
    MUTED_TEXT = '#64748b'      # Secondary labels
    GOLD_PRIMARY = '#c8952b'    # Antique Cambridge Gold
    GOLD_LIGHT = '#e5b869'      # Light Gold trim
    BORDER_LIGHT = '#cbd5e1'    # Table border lines
    BG_CREAM = '#fcfbf7'        # Subtle ivory parchment tone
    BG_CARD = '#f8fafc'         # Subtle dossier card background
    PASS_GREEN = '#047857'      # Cambridge Distinction Green
    DISTINCTION_BG = '#ecfdf5'

    # Fill canvas with subtle luxury parchment tone
    draw.rectangle([0, 0, W, H], fill=BG_CREAM)

    # ── 1. SUBTLE SECURITY GUILLOCHE BACKGROUND ──────────────────────────────
    # Fine security background diamond mesh
    step = 50
    for gx in range(60, W - 60, step * 2):
        draw.line([gx, 60, gx + 1200, H - 60], fill='#f1f5f9', width=1)
        draw.line([gx, H - 60, gx + 1200, 60], fill='#f1f5f9', width=1)

    # ── 2. ORNATE INTERNATIONAL CERTIFICATE BORDERS ─────────────────────────
    # Outer double frame
    draw.rectangle([50, 50, W - 50, H - 50], outline=DEEP_NAVY, width=6)
    draw.rectangle([62, 62, W - 62, H - 62], outline=GOLD_PRIMARY, width=3)
    draw.rectangle([70, 70, W - 70, H - 70], outline=BRAND_BLUE, width=1)
    draw.rectangle([76, 76, W - 76, H - 76], outline='#e2e8f0', width=1)

    # Four corner rosettes / filigree ornaments
    corner_size = 40
    corners = [(50, 50), (W - 50 - corner_size, 50), (50, H - 50 - corner_size), (W - 50 - corner_size, H - 50 - corner_size)]
    for cx, cy in corners:
        draw.rectangle([cx, cy, cx + corner_size, cy + corner_size], fill=GOLD_PRIMARY)
        draw.rectangle([cx + 6, cy + 6, cx + corner_size - 6, cy + corner_size - 6], fill=DEEP_NAVY)
        draw.rectangle([cx + 12, cy + 12, cx + corner_size - 12, cy + corner_size - 12], fill=GOLD_PRIMARY)

    # ── 3. FONTS ────────────────────────────────────────────────────────────
    font_dir = r"C:\Windows\Fonts"
    f_serif_bold = os.path.join(font_dir, "georgiab.ttf")
    f_serif = os.path.join(font_dir, "georgia.ttf")
    f_sans_bold = os.path.join(font_dir, "arialbd.ttf")
    f_sans = os.path.join(font_dir, "arial.ttf")

    font_school = ImageFont.truetype(f_serif_bold, 64)
    font_title = ImageFont.truetype(f_sans_bold, 36)
    font_sub = ImageFont.truetype(f_sans, 26)
    font_serial = ImageFont.truetype(f_sans_bold, 24)
    font_sec_title = ImageFont.truetype(f_sans_bold, 26)
    font_tbl_hdr = ImageFont.truetype(f_sans_bold, 24)
    font_cell = ImageFont.truetype(f_sans, 26)
    font_cell_bold = ImageFont.truetype(f_sans_bold, 26)
    font_badge = ImageFont.truetype(f_sans_bold, 22)
    font_sm = ImageFont.truetype(f_sans, 20)
    font_sig = ImageFont.truetype(f_serif, 30)

    # ── 4. HEADER WITH REAL LOGO, TITLES & VERIFICATION QR CODE ─────────────
    y = 110

    # Place Real School Logo on Left
    logo_path = 'logowb.png'
    logo_w, logo_h = 240, 240
    if os.path.exists(logo_path):
        logo_im = Image.open(logo_path).convert('RGBA')
        bbox = logo_im.getbbox()
        if bbox:
            logo_im = logo_im.crop(bbox)
        logo_im.thumbnail((logo_w, logo_h), Image.Resampling.LANCZOS)
        logo_x = 130
        img.paste(logo_im, (logo_x, y), logo_im)

    # QR Code on Right
    qr_x = W - 130 - 150
    draw_qr_code(draw, qr_x, y + 20, size=150)
    draw.text((qr_x - 10, y + 180), "SCAN TO VERIFY", fill=MUTED_TEXT, font=ImageFont.truetype(f_sans_bold, 17))
    draw.text((qr_x - 30, y + 204), "OFFICIAL RECORD", fill=MUTED_TEXT, font=ImageFont.truetype(f_sans, 16))

    # Center Institution Typography
    center_w = W - 2 * 340
    text_start_x = 380

    title_text = "CAMBRIDGE EDUCATION SYSTEM"
    draw.text((text_start_x, y + 15), title_text, fill=BRAND_BLUE, font=font_school)

    sub1 = "ANNUAL ACADEMIC TRANSCRIPT & PERFORMANCE DOSSIER"
    draw.text((text_start_x, y + 95), sub1, fill=DEEP_NAVY, font=font_title)

    sub2 = "Accredited British Curriculum Standards • Centre Registration: PK-0482"
    draw.text((text_start_x, y + 145), sub2, fill=GOLD_PRIMARY, font=font_sub)

    sub3 = "Affiliated with Cambridge Assessment International Education • UK Standards Framework"
    draw.text((text_start_x, y + 185), sub3, fill=MUTED_TEXT, font=ImageFont.truetype(f_sans, 22))

    y += 280

    # Gold Triple Ornamental Divider
    draw.line([130, y, W - 130, y], fill=DEEP_NAVY, width=3)
    draw.line([130, y + 4, W - 130, y + 4], fill=GOLD_PRIMARY, width=2)
    draw.line([130, y + 8, W - 130, y + 8], fill=BRAND_BLUE, width=1)
    y += 35

    # ── 5. CANDIDATE PROFILE MATRIX (OFFICIAL DOSSIER BOX) ──────────────────
    box_x = 120
    box_w = W - 240
    box_h = 240
    draw.rounded_rectangle([box_x, y, box_x + box_w, y + box_h], radius=16, fill='#ffffff', outline='#cbd5e1', width=2)
    # Left primary brand strip
    draw.rounded_rectangle([box_x, y, box_x + 12, y + box_h], radius=6, fill=BRAND_BLUE)

    # 4 columns x 3 rows of candidate identity
    r1_y = y + 25
    r2_y = y + 100
    r3_y = y + 175

    c1 = box_x + 40
    c2 = box_x + 620
    c3 = box_x + 1220
    c4 = box_x + 1780

    dossier = [
        ("CANDIDATE FULL NAME", "Bella Chen", c1, r1_y, True, DEEP_NAVY),
        ("ADMISSION / REG NO", "ADM-5019", c2, r1_y, True, BRAND_BLUE),
        ("CANDIDATE ROLL NO", "S-002", c3, r1_y, True, BRAND_BLUE),
        ("ACADEMIC SESSION", "2026–2027", c4, r1_y, True, DEEP_NAVY),

        ("CLASS & SECTION", "Class 5 — Cambridge Primary", c1, r2_y, True, DEEP_NAVY),
        ("DATE OF BIRTH", "18 May 2013 (Female)", c2, r2_y, False, SLATE_TEXT),
        ("ATTENDANCE RECORD", "98.4% (182 / 185 Days)", c3, r2_y, True, PASS_GREEN),
        ("TRANSCRIPT SERIAL", "CES/TR/2026/05019", c4, r2_y, False, MUTED_TEXT),

        ("BOARD DECISION", "PROMOTED WITH HONOURS TO CLASS 6", c1, r3_y, True, PASS_GREEN),
        ("CLASS RANKING", "Top 5% • Rank: 2nd / 34", c3, r3_y, True, BRAND_BLUE),
        ("DATE OF ISSUE", "18 November 2026", c4, r3_y, False, SLATE_TEXT)
    ]

    for item in dossier:
        label, val, fx, fy, is_bold, color = item
        draw.text((fx, fy), label, fill=MUTED_TEXT, font=font_badge)
        draw.text((fx, fy + 32), val, fill=color, font=font_cell_bold if is_bold else font_cell)

    y += box_h + 40

    # ── 6. ACADEMIC ASSESSMENT MATRIX (INTERNATIONAL MULTI-TIER EVALUATION) ──
    table_x = 120
    table_w = W - 240

    # Column layout:
    # Code(120), Subject(560), Monthly(240), Tasks(240), Mid-Term(240), Terminal(260), Total(260), Grade(140), Status(180)
    # Sum: 120+560+240+240+240+260+260+140+180 = 2240 (Matches table_w)
    headers = [
        ("CODE", 120, 'C'),
        ("SUBJECT TITLE", 560, 'L'),
        ("MONTHLY\nTESTS (15)", 240, 'C'),
        ("TASKS &\nASSIGN (10)", 240, 'C'),
        ("MID-TERM\nEXAM (25)", 240, 'C'),
        ("TERMINAL\nEXAM (50)", 260, 'C'),
        ("TOTAL MARKS\nOBTAINED (100)", 260, 'C'),
        ("GRADE", 140, 'C'),
        ("RESULT", 180, 'C')
    ]

    header_h = 95
    draw.rectangle([table_x, y, table_x + table_w, y + header_h], fill=DEEP_NAVY)
    draw.rectangle([table_x, y + header_h - 4, table_x + table_w, y + header_h], fill=GOLD_PRIMARY)

    cur_x = table_x
    for name, w_col, align in headers:
        lines = name.split('\n')
        total_text_h = len(lines) * 26
        start_ty = y + (header_h - total_text_h) // 2
        for l_idx, line in enumerate(lines):
            t_bbox = draw.textbbox((0, 0), line, font=font_tbl_hdr)
            tw = t_bbox[2] - t_bbox[0]
            if align == 'C':
                tx = cur_x + (w_col - tw) // 2
            elif align == 'R':
                tx = cur_x + w_col - tw - 20
            else:
                tx = cur_x + 24
            draw.text((tx, start_ty + l_idx * 26), line, fill='#ffffff', font=font_tbl_hdr)
        cur_x += w_col

    y += header_h

    # Subject Records
    rows = [
        ("0846", "Mathematics (Cambridge Primary)", "12.5 / 15", "9.0 / 10", "20.5 / 25", "37.0 / 50", "79.0 / 100", "B", "Very Good"),
        ("0844", "English as a First Language", "12.0 / 15", "8.5 / 10", "21.0 / 25", "36.5 / 50", "78.0 / 100", "B", "Very Good"),
        ("0845", "General Science (Biology, Chem & Physics)", "13.5 / 15", "9.2 / 10", "23.0 / 25", "42.5 / 50", "88.2 / 100", "A", "Distinction"),
        ("0470", "Global Perspectives & Social Studies", "12.2 / 15", "8.8 / 10", "19.5 / 25", "35.5 / 50", "76.0 / 100", "B", "Meritorious"),
        ("0478", "Computer Science & Robotics", "14.0 / 15", "9.8 / 10", "23.5 / 25", "44.0 / 50", "91.3 / 100", "A*", "Outstanding"),
        ("0539", "Urdu Literature & Composition", "11.5 / 15", "8.2 / 10", "19.0 / 25", "34.5 / 50", "73.2 / 100", "B", "Proficient"),
        ("0493", "Islamic Studies & Moral Education", "14.2 / 15", "9.6 / 10", "24.0 / 25", "43.5 / 50", "91.3 / 100", "A*", "Outstanding")
    ]

    row_h = 76
    for idx, r in enumerate(rows):
        bg_col = '#ffffff' if idx % 2 == 0 else '#f8fafc'
        draw.rectangle([table_x, y, table_x + table_w, y + row_h], fill=bg_col)
        draw.line([table_x, y + row_h, table_x + table_w, y + row_h], fill=BORDER_LIGHT, width=1)

        cur_x = table_x
        for c_idx, cell in enumerate(r):
            w_col = headers[c_idx][1]
            align = headers[c_idx][2]
            f_use = font_cell_bold if c_idx in [1, 6, 7] else font_cell
            color = SLATE_TEXT

            if c_idx == 0:
                color = MUTED_TEXT
                f_use = ImageFont.truetype(f_sans_bold, 22)
            elif c_idx == 1:
                color = DEEP_NAVY
            elif c_idx == 6: # Total
                color = BRAND_BLUE
                f_use = ImageFont.truetype(f_sans_bold, 26)
            elif c_idx == 7: # Grade
                color = PASS_GREEN if cell in ['A*', 'A'] else '#1d4ed8'
            elif c_idx == 8: # Remarks
                color = PASS_GREEN if 'Distinction' in cell or 'Outstanding' in cell else '#1e40af'

            t_bbox = draw.textbbox((0, 0), cell, font=f_use)
            tw = t_bbox[2] - t_bbox[0]
            th = t_bbox[3] - t_bbox[1]
            ty = y + (row_h - th) // 2

            if align == 'C':
                tx = cur_x + (w_col - tw) // 2
            elif align == 'R':
                tx = cur_x + w_col - tw - 24
            else:
                tx = cur_x + 24

            # Grade pill container
            if c_idx == 7:
                badge_w = 64
                bx = cur_x + (w_col - badge_w) // 2
                draw.rounded_rectangle([bx, y + 14, bx + badge_w, y + row_h - 14], radius=8, fill='#ecfdf5' if cell in ['A*', 'A'] else '#eff6ff', outline='#bbf7d0' if cell in ['A*', 'A'] else '#bfdbfe', width=1)
                draw.text((tx, ty), cell, fill=color, font=f_use)
            else:
                draw.text((tx, ty), cell, fill=color, font=f_use)

            cur_x += w_col

        y += row_h

    # Table Summary Aggregate Row
    foot_h = 86
    draw.rectangle([table_x, y, table_x + table_w, y + foot_h], fill='#f1f5f9')
    draw.rectangle([table_x, y, table_x + table_w, y + 3], fill=BRAND_BLUE)
    draw.line([table_x, y + foot_h, table_x + table_w, y + foot_h], fill=BORDER_LIGHT, width=1)

    cur_x = table_x
    totals = [
        "—", "CUMULATIVE MARKS AGGREGATE", "89.9 / 105", "64.3 / 70", "150.5 / 175", "273.0 / 350", "577.0 / 700", "A", "PASSED"
    ]
    for c_idx, cell in enumerate(totals):
        w_col = headers[c_idx][1]
        align = headers[c_idx][2]
        f_use = ImageFont.truetype(f_sans_bold, 28) if c_idx == 6 else ImageFont.truetype(f_sans_bold, 24)
        color = BRAND_BLUE if c_idx in [1, 6] else PASS_GREEN if c_idx in [7, 8] else DEEP_NAVY

        t_bbox = draw.textbbox((0, 0), cell, font=f_use)
        tw = t_bbox[2] - t_bbox[0]
        th = t_bbox[3] - t_bbox[1]
        ty = y + (foot_h - th) // 2

        if align == 'C':
            tx = cur_x + (w_col - tw) // 2
        elif align == 'R':
            tx = cur_x + w_col - tw - 24
        else:
            tx = cur_x + 24

        draw.text((tx, ty), cell, fill=color, font=f_use)
        cur_x += w_col

    y += foot_h + 40

    # ── 7. LUXURY PERFORMANCE SUMMARY BANNER ─────────────────────────────────
    sum_box_w = W - 240
    sum_box_h = 135
    draw.rounded_rectangle([box_x, y, box_x + sum_box_w, y + sum_box_h], radius=16, fill='#ffffff', outline='#bbf7d0', width=2)
    # Green accent strip
    draw.rounded_rectangle([box_x, y, box_x + 12, y + sum_box_h], radius=6, fill=PASS_GREEN)

    s1 = box_x + 50
    s2 = box_x + 600
    s3 = box_x + 1150
    s4 = box_x + 1720

    draw.text((s1, y + 24), "TOTAL MARKS ACCUMULATED", fill=MUTED_TEXT, font=font_badge)
    draw.text((s1, y + 62), "577.0 / 700.0", fill=BRAND_BLUE, font=ImageFont.truetype(f_sans_bold, 40))

    draw.text((s2, y + 24), "ANNUAL AGGREGATE %", fill=MUTED_TEXT, font=font_badge)
    draw.text((s2, y + 62), "82.43%", fill=BRAND_BLUE, font=ImageFont.truetype(f_sans_bold, 40))

    draw.text((s3, y + 24), "OVERALL CUMULATIVE GRADE", fill=MUTED_TEXT, font=font_badge)
    draw.text((s3, y + 62), "Grade A (Distinction)", fill=PASS_GREEN, font=ImageFont.truetype(f_sans_bold, 36))

    draw.text((s4, y + 24), "ACADEMIC BOARD RESOLUTION", fill=MUTED_TEXT, font=font_badge)
    draw.text((s4, y + 64), "Promoted to Class 6", fill=PASS_GREEN, font=ImageFont.truetype(f_sans_bold, 32))

    y += sum_box_h + 40

    # ── 8. CAMBRIDGE INTERNATIONAL GRADING DESCRIPTOR KEY ────────────────────
    key_h = 110
    draw.rounded_rectangle([box_x, y, box_x + sum_box_w, y + key_h], radius=12, fill='#ffffff', outline=BORDER_LIGHT, width=1)
    draw.text((box_x + 25, y + 14), "CAMBRIDGE ASSESSMENT INTERNATIONAL GRADING THRESHOLDS & BENCHMARKS", fill=DEEP_NAVY, font=font_badge)

    scales = [
        ("A* (90–100%)", "Outstanding with Distinction", "#047857"),
        ("A (80–89%)", "Excellent Mastery", "#047857"),
        ("B (70–79%)", "Very Good Performance", "#1d4ed8"),
        ("C (60–69%)", "Good Proficiency", "#2563eb"),
        ("D (50–59%)", "Satisfactory Pass", "#d97706"),
        ("E (40–49%)", "Minimum Passing Threshold", "#ea580c"),
        ("U (< 40%)", "Ungraded / Re-sit Required", "#dc2626")
    ]

    r1_scales = scales[:4]
    r2_scales = scales[4:]

    cur_k_x = box_x + 25
    for tag, desc, col in r1_scales:
        draw.text((cur_k_x, y + 46), f"{tag}: {desc}", fill=col, font=font_sm)
        cur_k_x += 540

    cur_k_x = box_x + 25
    for tag, desc, col in r2_scales:
        draw.text((cur_k_x, y + 74), f"{tag}: {desc}", fill=col, font=font_sm)
        cur_k_x += 540

    y += key_h + 85

    # ── 9. INSTITUTIONAL AUTHENTICATION & SIGNATURES ─────────────────────────
    sig_line_y = y + 80

    # 1. Class Teacher
    t_x1, t_x2 = 180, 580
    draw.line([t_x1, sig_line_y, t_x2, sig_line_y], fill=DEEP_NAVY, width=2)
    draw.text((230, sig_line_y + 16), "Class Preceptor / Teacher", fill=MUTED_TEXT, font=font_cell)
    draw.text((270, sig_line_y - 52), "Sarah Jenkins, M.Ed.", fill=DEEP_NAVY, font=font_sig)

    # 2. Controller of Examinations
    c_x1, c_x2 = 780, 1180
    draw.line([c_x1, sig_line_y, c_x2, sig_line_y], fill=DEEP_NAVY, width=2)
    draw.text((820, sig_line_y + 16), "Controller of Examinations", fill=MUTED_TEXT, font=font_cell)
    draw.text((850, sig_line_y - 52), "Dr. Farooq Ahmed", fill=DEEP_NAVY, font=font_sig)

    # 3. Principal & Head of Institution
    p_x1, p_x2 = W - 580, W - 180
    draw.line([p_x1, sig_line_y, p_x2, sig_line_y], fill=DEEP_NAVY, width=2)
    draw.text((p_x1 + 40, sig_line_y + 16), "Principal & Academic Director", fill=MUTED_TEXT, font=font_cell)
    draw.text((p_x1 + 60, sig_line_y - 52), "Prof. Tariq Mahmood", fill=DEEP_NAVY, font=font_sig)

    # 4. Central Stamped Institutional Seal
    seal_cx = (c_x2 + p_x1) // 2
    seal_cy = sig_line_y - 20
    seal_r = 95
    draw.ellipse([seal_cx - seal_r, seal_cy - seal_r, seal_cx + seal_r, seal_cy + seal_r], outline=GOLD_PRIMARY, width=5)
    draw.ellipse([seal_cx - seal_r + 6, seal_cy - seal_r + 6, seal_cx + seal_r - 6, seal_cy + seal_r - 6], outline=DEEP_NAVY, width=2)
    draw.ellipse([seal_cx - seal_r + 12, seal_cy - seal_r + 12, seal_cx + seal_r - 12, seal_cy + seal_r - 12], fill='#fdfbf7')

    draw.text((seal_cx - 60, seal_cy - 48), "CAMBRIDGE", fill=BRAND_BLUE, font=font_badge)
    draw.text((seal_cx - 55, seal_cy - 20), "EDUCATION", fill=BRAND_BLUE, font=font_badge)
    draw.text((seal_cx - 42, seal_cy + 8), "★ SYSTEM ★", fill=GOLD_PRIMARY, font=font_badge)
    draw.text((seal_cx - 62, seal_cy + 34), "OFFICIAL SEAL", fill=PASS_GREEN, font=font_badge)

    # Security Footnote
    foot_text = "This certified transcript is issued under the authority of the Cambridge Education System Academic Board. Security verification code: CES-VER-8849-PK"
    f_bbox = draw.textbbox((0, 0), foot_text, font=ImageFont.truetype(f_sans, 18))
    draw.text(((W - (f_bbox[2] - f_bbox[0])) // 2, H - 95), foot_text, fill=MUTED_TEXT, font=ImageFont.truetype(f_sans, 18))

    # Save to disk
    out_artifact = r"C:\Users\Ansari\.gemini\antigravity\brain\4ff5126a-2c28-460b-9c8f-e4dd85fa67bb\cambridge_international_standard_result_card.png"
    out_docs = r"docs\cambridge_international_standard_result_card.png"

    img.save(out_artifact, quality=98)
    img.save(out_docs, quality=98)
    print("SUCCESS: International Standard Result Card generated at:", out_artifact)
    print("SUCCESS: Copied to docs:", out_docs)

if __name__ == '__main__':
    render_international_result_card()
