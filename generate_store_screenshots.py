import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

os.makedirs('assets/screenshots', exist_ok=True)

# Helper to load system fonts
def get_font(size, bold=False, mono=False):
    if mono:
        f_path = 'C:/Windows/Fonts/consola.ttf'
    elif bold:
        f_path = 'C:/Windows/Fonts/segoeuib.ttf'
    else:
        f_path = 'C:/Windows/Fonts/segoeui.ttf'
    try:
        return ImageFont.truetype(f_path, size)
    except Exception:
        return ImageFont.load_default()

# Load official brand logo
logo_raw = None
if os.path.exists('assets/logo-transparent.png'):
    try:
        logo_raw = Image.open('assets/logo-transparent.png').convert('RGBA')
    except Exception:
        pass

# Color Palette (Midnight Slate & Velocity Mint)
BG_CANVAS = (7, 13, 30)         # #070D1E
BG_HEADER = (11, 17, 32)        # #0B1120
SURFACE_CARD = (15, 23, 42)     # #0F172A
SURFACE_ELEVATED = (22, 35, 63) # #16233F
SURFACE_INPUT = (11, 19, 43)    # #0B132B
BORDER_SUBTLE = (30, 41, 59)    # #1E293B
BORDER_CYAN = (56, 189, 248)    # #38BDF8
CYAN_PRIMARY = (2, 132, 199)    # #0284C7
MINT_ACCENT = (52, 211, 153)    # #34D399
MINT_DEEP = (16, 185, 129)      # #10B981
TEXT_MAIN = (248, 250, 252)     # #F8FAFC
TEXT_MUTED = (148, 163, 184)    # #94A3B8
TEXT_SUB = (100, 116, 139)      # #64748B

def draw_clover_top_bar(img, draw, title, subtitle):
    # Top Clover Navigation Bar (Dark Midnight POS Header)
    draw.rectangle([(0, 0), (1920, 75)], fill=BG_HEADER)
    draw.line([(0, 75), (1920, 75)], fill=BORDER_SUBTLE, width=1)
    
    # Clover Logo & POS indicator
    draw.text((40, 20), "Clover® POS", font=get_font(26, True), fill=MINT_ACCENT)
    draw.text((220, 24), "•   Register  >  AutoShip Multi-Carrier Rates", font=get_font(20), fill=TEXT_MUTED)
    draw.text((1600, 24), "Station Terminal #102  •  Online", font=get_font(18), fill=MINT_ACCENT)
    
    # Branded Title Bar with AutoShip Logo
    draw.rectangle([(0, 75), (1920, 155)], fill=SURFACE_CARD)
    draw.line([(0, 155), (1920, 155)], fill=BORDER_SUBTLE, width=2)
    
    if logo_raw:
        logo_icon = logo_raw.resize((54, 54), Image.Resampling.LANCZOS)
        img.paste(logo_icon, (40, 88), logo_icon)
        draw.text((108, 92), "AutoShip", font=get_font(28, True), fill=BORDER_CYAN)
        draw.text((245, 96), f"—  {title}", font=get_font(24, True), fill=TEXT_MAIN)
    else:
        draw.text((40, 95), title, font=get_font(26, True), fill=TEXT_MAIN)
        
    draw.text((800, 100), subtitle, font=get_font(18), fill=TEXT_MUTED)

# ==============================================================================
# SCREENSHOT 1: RATE SHOPPING ON CLOVER STATION (MIDNIGHT SLATE)
# ==============================================================================
def make_screenshot_1():
    img = Image.new('RGB', (1920, 1080), BG_CANVAS)
    draw = ImageDraw.Draw(img)
    draw_clover_top_bar(img, draw, "Multi-Carrier Rate Shopping", "Order #K194  •  3 Items ($128.50)  •  Medium Box (10×7×5 in)")
    
    # Left Column: Destination & Packaging Cards (Width: 630)
    # Card 1: Destination
    draw.rounded_rectangle([(40, 180), (670, 480)], radius=14, fill=SURFACE_CARD, outline=BORDER_SUBTLE, width=2)
    draw.text((70, 205), "📍 Destination Delivery Address", font=get_font(20, True), fill=TEXT_MAIN)
    
    # Edit Button in Cyan
    draw.rounded_rectangle([(530, 202), (640, 238)], radius=6, fill=SURFACE_ELEVATED, outline=BORDER_CYAN, width=1)
    draw.text((548, 208), "Edit Address", font=get_font(13, True), fill=BORDER_CYAN)
    
    draw.text((70, 255), "Recipient:", font=get_font(16), fill=TEXT_SUB)
    draw.text((180, 255), "Sarah Jenkins", font=get_font(18, True), fill=TEXT_MAIN)
    draw.text((70, 290), "Street:", font=get_font(16), fill=TEXT_SUB)
    draw.text((180, 290), "742 Evergreen Terrace, Suite 4B", font=get_font(18), fill=TEXT_MAIN)
    draw.text((70, 325), "City, State:", font=get_font(16), fill=TEXT_SUB)
    draw.text((180, 325), "Springfield, OR 97477 (United States)", font=get_font(18), fill=TEXT_MAIN)
    draw.text((70, 360), "Zone Status:", font=get_font(16), fill=TEXT_SUB)
    
    # Verified badge in Velocity Mint
    draw.rounded_rectangle([(180, 356), (560, 392)], radius=6, fill=(6, 78, 59), outline=MINT_DEEP, width=1)
    draw.text((195, 362), "✓ USPS Delivery Validated • Zone 4", font=get_font(14, True), fill=MINT_ACCENT)
    
    # Phone
    draw.text((70, 415), "Customer Phone:  (541) 555-0192  (Tracking SMS Enabled)", font=get_font(14), fill=TEXT_MUTED)

    # Card 2: Packaging & Insurance
    draw.rounded_rectangle([(40, 505), (670, 920)], radius=14, fill=SURFACE_CARD, outline=BORDER_SUBTLE, width=2)
    draw.text((70, 530), "📦 3D Smart Packaging & Protection", font=get_font(20, True), fill=TEXT_MAIN)
    
    draw.text((70, 575), "Packaging Preset:", font=get_font(16), fill=TEXT_SUB)
    draw.text((220, 575), "Medium Box (Preset #2)", font=get_font(18, True), fill=BORDER_CYAN)
    draw.text((70, 610), "Dimensions:", font=get_font(16), fill=TEXT_SUB)
    draw.text((220, 610), "10.0\" × 7.0\" × 5.0\"  (3D Bin Packed)", font=get_font(17), fill=TEXT_MAIN)
    draw.text((70, 645), "Scale Weight:", font=get_font(16), fill=TEXT_SUB)
    draw.text((220, 645), "2 lbs 6 oz (38.0 oz)", font=get_font(17), fill=TEXT_MAIN)
    draw.text((70, 680), "Volume Fit:", font=get_font(16), fill=TEXT_SUB)
    draw.text((220, 680), "84% Volume Packing Efficiency", font=get_font(17), fill=MINT_ACCENT)
    
    draw.line([(70, 720), (640, 720)], fill=BORDER_SUBTLE, width=1)
    
    # Insurance Card in Dark Cyan Glass
    draw.rounded_rectangle([(70, 740), (640, 885)], radius=10, fill=(12, 43, 78), outline=CYAN_PRIMARY, width=1)
    draw.text((95, 760), "🛡️ Shipment Protection Insurance", font=get_font(18, True), fill=BORDER_CYAN)
    draw.text((95, 792), "Covers 100% declared replacement for loss or damage ($128.50)", font=get_font(14), fill=TEXT_MAIN)
    draw.text((95, 825), "AutoShip Protection Fee: +$1.35", font=get_font(15, True), fill=MINT_ACCENT)
    
    # Toggle switch active
    draw.rounded_rectangle([(510, 835), (615, 868)], radius=16, fill=MINT_DEEP)
    draw.ellipse([(580, 837), (612, 866)], fill=(255, 255, 255))
    draw.text((525, 843), "ON", font=get_font(14, True), fill=(255, 255, 255))

    # Right Column: Live Carrier Rates (Width: 1170)
    draw.text((710, 180), "Live Carrier Postage Rates (Real-Time EasyPost Pricing)", font=get_font(22, True), fill=TEXT_MAIN)

    rates = [
        ("USPS", "Ground Advantage", "Est. 2-5 Business Days (Mon, Oct 27)", "$7.85", True, (56, 189, 248), "RECOMMENDED • BEST VALUE"),
        ("USPS", "Priority Mail®", "Est. 1-3 Business Days (Sat, Oct 25)", "$11.40", False, (56, 189, 248), ""),
        ("UPS", "Ground®", "Est. 2 Business Days (Fri, Oct 24)", "$9.95", False, (245, 158, 11), "FAST 2-DAY GROUND"),
        ("UPS", "2nd Day Air®", "Guaranteed by End of Day", "$19.50", False, (245, 158, 11), ""),
        ("FedEx", "Home Delivery®", "Est. 2-4 Days (Includes Weekend Delivery)", "$10.25", False, (192, 132, 252), "")
    ]

    ry = 220
    for carrier, service, delivery, price, is_sel, col, tag in rates:
        card_bg = SURFACE_ELEVATED if is_sel else SURFACE_CARD
        card_border = BORDER_CYAN if is_sel else BORDER_SUBTLE
        stroke_w = 3 if is_sel else 1
        draw.rounded_rectangle([(710, ry), (1880, ry + 115)], radius=12, fill=card_bg, outline=card_border, width=stroke_w)
        
        # Radio circle
        draw.ellipse([(735, ry + 42), (765, ry + 72)], outline=BORDER_CYAN if is_sel else TEXT_SUB, width=2)
        if is_sel:
            draw.ellipse([(741, ry + 48), (759, ry + 66)], fill=BORDER_CYAN)
        
        # Carrier Pill
        draw.rounded_rectangle([(785, ry + 25), (895, ry + 68)], radius=8, fill=(11, 19, 43), outline=col, width=1)
        draw.text((805, ry + 32), carrier, font=get_font(18, True), fill=col)
        
        # Service & ETA
        draw.text((920, ry + 25), service, font=get_font(22, True), fill=TEXT_MAIN)
        draw.text((920, ry + 66), delivery, font=get_font(15), fill=TEXT_MUTED)
        
        if tag:
            draw.rounded_rectangle([(1260, ry + 25), (1530, ry + 58)], radius=6, fill=(6, 78, 59), outline=MINT_DEEP, width=1)
            draw.text((1275, ry + 31), tag, font=get_font(13, True), fill=MINT_ACCENT)
            
        # Price
        draw.text((1720, ry + 28), price, font=get_font(32, True), fill=BORDER_CYAN if is_sel else TEXT_MAIN)
        if is_sel:
            draw.text((1720, ry + 75), "SELECTED ✓", font=get_font(13, True), fill=BORDER_CYAN)
            
        ry += 135

    # Bottom Sticky Action Bar
    draw.rectangle([(0, 955), (1920, 1080)], fill=SURFACE_CARD)
    draw.line([(0, 955), (1920, 955)], fill=BORDER_SUBTLE, width=2)
    
    # Back button
    draw.rounded_rectangle([(40, 980), (280, 1055)], radius=10, fill=SURFACE_ELEVATED, outline=BORDER_SUBTLE, width=1)
    draw.text((90, 1002), "← Back to Cart", font=get_font(18, True), fill=TEXT_MUTED)
    
    # Total calculation summary
    draw.text((1120, 992), "Total Shipping & Protection:", font=get_font(15), fill=TEXT_MUTED)
    draw.text((1120, 1018), "$7.85 postage + $1.35 ins", font=get_font(14), fill=TEXT_SUB)
    draw.text((1340, 995), "$9.20", font=get_font(28, True), fill=TEXT_MAIN)

    # Primary Action Button in Velocity Mint
    draw.rounded_rectangle([(1430, 975), (1880, 1060)], radius=10, fill=MINT_DEEP)
    draw.text((1465, 1000), "Apply Shipping to Order  ($9.20)  ➔", font=get_font(20, True), fill=(255, 255, 255))
    
    img.save('assets/screenshots/01-clover-pos-rate-selection.png')
    print('Generated assets/screenshots/01-clover-pos-rate-selection.png')

# ==============================================================================
# SCREENSHOT 2: ADDRESS MODAL & DESTINATION VERIFICATION (MIDNIGHT SLATE)
# ==============================================================================
def make_screenshot_2():
    img = Image.new('RGB', (1920, 1080), BG_CANVAS)
    draw = ImageDraw.Draw(img)
    draw_clover_top_bar(img, draw, "Customer Delivery Address", "Validate recipient address for accurate carrier quoting")

    # Dark translucent backdrop overlay for modal
    overlay = Image.new('RGBA', (1920, 1080), (7, 13, 30, 210))
    img.paste(Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB'))
    draw = ImageDraw.Draw(img)
    
    # Centered Dialog Modal (Width 900, Height 740)
    dx1, dy1, dx2, dy2 = 510, 190, 1410, 950
    draw.rounded_rectangle([(dx1, dy1), (dx2, dy2)], radius=18, fill=SURFACE_CARD, outline=BORDER_CYAN, width=2)
    
    # Modal Header with Pin
    draw.text((dx1 + 45, dy1 + 35), "📍 Enter Shipping Destination", font=get_font(24, True), fill=TEXT_MAIN)
    draw.text((dx1 + 45, dy1 + 75), "Auto-populated from Clover customer database or enter a new address", font=get_font(15), fill=TEXT_MUTED)
    
    # Clover Customer auto-detected banner in Mint
    draw.rounded_rectangle([(dx1 + 45, dy1 + 115), (dx2 - 45, dy1 + 175)], radius=8, fill=(6, 78, 59), outline=MINT_DEEP, width=1)
    draw.text((dx1 + 70, dy1 + 133), "✓ Linked to Clover Customer: Sarah Jenkins  (sarah.j@example.com)", font=get_font(16, True), fill=MINT_ACCENT)

    # Form Fields in Midnight Dark Inputs
    fields = [
        ("Recipient Full Name *", "Sarah Jenkins"),
        ("Street Address Line 1 *", "742 Evergreen Terrace"),
        ("Apartment, Suite, Unit (Optional)", "Suite 4B")
    ]
    
    fy = dy1 + 195
    for label, val in fields:
        draw.text((dx1 + 45, fy), label, font=get_font(14, True), fill=BORDER_CYAN)
        draw.rounded_rectangle([(dx1 + 45, fy + 24), (dx2 - 45, fy + 76)], radius=8, fill=SURFACE_INPUT, outline=BORDER_SUBTLE, width=1)
        draw.text((dx1 + 65, fy + 38), val, font=get_font(17), fill=TEXT_MAIN)
        fy += 88
        
    # City, State, ZIP row
    cy = fy
    # City (Width 400)
    draw.text((dx1 + 45, cy), "City *", font=get_font(14, True), fill=BORDER_CYAN)
    draw.rounded_rectangle([(dx1 + 45, cy + 24), (dx1 + 440, cy + 76)], radius=8, fill=SURFACE_INPUT, outline=BORDER_SUBTLE, width=1)
    draw.text((dx1 + 65, cy + 38), "Springfield", font=get_font(17), fill=TEXT_MAIN)
    
    # State (Width 160)
    draw.text((dx1 + 460, cy), "State *", font=get_font(14, True), fill=BORDER_CYAN)
    draw.rounded_rectangle([(dx1 + 460, cy + 24), (dx1 + 610, cy + 76)], radius=8, fill=SURFACE_INPUT, outline=BORDER_SUBTLE, width=1)
    draw.text((dx1 + 510, cy + 38), "OR", font=get_font(17), fill=TEXT_MAIN)

    # ZIP (Width 225)
    draw.text((dx1 + 630, cy), "ZIP Code *", font=get_font(14, True), fill=BORDER_CYAN)
    draw.rounded_rectangle([(dx1 + 630, cy + 24), (dx2 - 45, cy + 76)], radius=8, fill=SURFACE_INPUT, outline=BORDER_CYAN, width=2)
    draw.text((dx1 + 655, cy + 38), "97477", font=get_font(17, True), fill=BORDER_CYAN)

    # Phone Row
    py = cy + 90
    draw.text((dx1 + 45, py), "Customer Phone (for Delivery Tracking Updates)", font=get_font(14, True), fill=TEXT_MUTED)
    draw.rounded_rectangle([(dx1 + 45, py + 24), (dx2 - 45, py + 76)], radius=8, fill=SURFACE_INPUT, outline=BORDER_SUBTLE, width=1)
    draw.text((dx1 + 65, py + 38), "(541) 555-0192", font=get_font(17), fill=TEXT_MAIN)

    # USPS Verification status
    vy = py + 88
    draw.text((dx1 + 45, vy), "Postal Delivery Validation: Zone 4 (USPS Commercial Delivery Point Validated ✓)", font=get_font(14, True), fill=MINT_ACCENT)

    # Action Buttons
    by = dy2 - 80
    draw.rounded_rectangle([(dx1 + 45, by), (dx1 + 220, by + 54)], radius=8, fill=SURFACE_ELEVATED, outline=BORDER_SUBTLE, width=1)
    draw.text((dx1 + 95, by + 16), "Cancel", font=get_font(16, True), fill=TEXT_MUTED)

    draw.rounded_rectangle([(dx2 - 340, by), (dx2 - 45, by + 54)], radius=8, fill=MINT_DEEP)
    draw.text((dx2 - 310, by + 16), "Calculate Live Rates  ➔", font=get_font(17, True), fill=(255, 255, 255))

    img.save('assets/screenshots/02-address-validation-dialog.png')
    print('Generated assets/screenshots/02-address-validation-dialog.png')

# ==============================================================================
# SCREENSHOT 3: PROMOTION DISCOUNT & INSTANT FULFILLMENT (MIDNIGHT SLATE)
# ==============================================================================
def make_screenshot_3():
    img = Image.new('RGB', (1920, 1080), BG_CANVAS)
    draw = ImageDraw.Draw(img)
    draw_clover_top_bar(img, draw, "Active Register Checkout", "AutoShip Free Shipping Threshold Promo automatically applied")

    # Left Side: Clover Register Order Cart (Width: 1100)
    draw.rounded_rectangle([(40, 180), (1140, 940)], radius=14, fill=SURFACE_CARD, outline=BORDER_SUBTLE, width=2)
    draw.text((70, 205), "🛒 Current Clover Order (4 Items)", font=get_font(22, True), fill=TEXT_MAIN)
    
    # Free Shipping Alert Banner
    draw.rounded_rectangle([(70, 255), (1110, 325)], radius=10, fill=(6, 78, 59), outline=MINT_DEEP, width=2)
    draw.text((95, 270), "🎉 FREE SHIPPING PROMOTION UNLOCKED!", font=get_font(18, True), fill=MINT_ACCENT)
    draw.text((95, 296), "Order subtotal is $145.00, exceeding your store's $100.00 free shipping rule ($8.95 waived).", font=get_font(14), fill=TEXT_MAIN)

    # Line Items in Dark Theme
    items = [
        ("Artisan Roast Coffee Beans (12 oz)", "2 × $18.50", "$37.00"),
        ("Handmade Ceramic Pour-Over Dripper", "1 × $48.00", "$48.00"),
        ("Stainless Steel Precision Kettle", "1 × $60.00", "$60.00"),
        ("Shipping: USPS Ground Advantage (Tracking Included)", "Standard Delivery (2-5 Days)", "$8.95"),
        ("Promo Discount: Free Shipping ($100+)", "AutoShip Rule Discount", "-$8.95")
    ]

    iy = 350
    for name, sub, price in items:
        is_promo = "Promo Discount" in name
        is_ship = "Shipping:" in name
        
        row_bg = (12, 43, 78) if is_ship else ((6, 78, 59) if is_promo else SURFACE_ELEVATED)
        row_border = CYAN_PRIMARY if is_ship else (MINT_DEEP if is_promo else BORDER_SUBTLE)
        draw.rounded_rectangle([(70, iy), (1110, iy + 74)], radius=8, fill=row_bg, outline=row_border, width=1)
        
        col_text = MINT_ACCENT if is_promo else (BORDER_CYAN if is_ship else TEXT_MAIN)
        draw.text((95, iy + 14), name, font=get_font(17, True), fill=col_text)
        draw.text((95, iy + 42), sub, font=get_font(14), fill=TEXT_MUTED)
        
        draw.text((980, iy + 22), price, font=get_font(22, True), fill=col_text)
        iy += 88

    # Order Totals Summary
    ty = 800
    draw.line([(70, ty), (1110, ty)], fill=BORDER_SUBTLE, width=2)
    draw.text((700, ty + 18), "Cart Subtotal:", font=get_font(17), fill=TEXT_MUTED)
    draw.text((1010, ty + 18), "$145.00", font=get_font(17), fill=TEXT_MAIN)
    
    draw.text((700, ty + 46), "Shipping Postage:", font=get_font(17), fill=TEXT_MUTED)
    draw.text((1010, ty + 46), "$0.00 (WAIVED)", font=get_font(17, True), fill=MINT_ACCENT)
    
    draw.text((700, ty + 80), "Total to Pay:", font=get_font(22, True), fill=TEXT_MAIN)
    draw.text((975, ty + 78), "$145.00", font=get_font(28, True), fill=MINT_ACCENT)

    # Right Side: Cashier Action Box (Width: 680)
    draw.rounded_rectangle([(1180, 180), (1880, 940)], radius=14, fill=SURFACE_CARD, outline=BORDER_SUBTLE, width=2)
    draw.text((1220, 210), "⚡ Instant Thermal Label Fulfillment", font=get_font(22, True), fill=TEXT_MAIN)
    
    draw.text((1220, 260), "• 4\"×6\" postage label prints instantly upon Clover payment", font=get_font(15), fill=TEXT_MUTED)
    draw.text((1220, 292), "• Live tracking code automatically attached to Clover digital receipt", font=get_font(15), fill=TEXT_MUTED)
    draw.text((1220, 324), "• Commercial Base postage discount applied (EasyPost)", font=get_font(15, True), fill=BORDER_CYAN)

    # Simulated Thermal Label (Crisp 4"x6" Label on White Backplate)
    lx1, ly1, lx2, ly2 = 1300, 380, 1760, 810
    draw.rounded_rectangle([(lx1, ly1), (lx2, ly2)], radius=8, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    
    # Label Header
    draw.text((lx1 + 25, ly1 + 20), "USPS GROUND ADVANTAGE™", font=get_font(18, True), fill=(15, 23, 42))
    draw.text((lx1 + 25, ly1 + 45), "COMMERCIAL BASE PRICING  •  ZONE 4", font=get_font(12, True), fill=(71, 85, 105))
    draw.line([(lx1 + 25, ly1 + 70), (lx2 - 25, ly1 + 70)], fill=(15, 23, 42), width=2)
    
    draw.text((lx1 + 25, ly1 + 80), "SHIP TO:", font=get_font(12, True), fill=(71, 85, 105))
    draw.text((lx1 + 25, ly1 + 100), "SARAH JENKINS\n742 EVERGREEN TERRACE, STE 4B\nSPRINGFIELD OR 97477", font=get_font(14, True), fill=(15, 23, 42))
    
    # Routing code & box
    draw.rounded_rectangle([(lx1 + 330, ly1 + 80), (lx2 - 25, ly1 + 140)], radius=4, outline=(15, 23, 42), width=2)
    draw.text((lx1 + 345, ly1 + 95), "OR-974", font=get_font(16, True), fill=(15, 23, 42))
    
    draw.line([(lx1 + 25, ly1 + 170), (lx2 - 25, ly1 + 170)], fill=(15, 23, 42), width=1)
    draw.text((lx1 + 25, ly1 + 180), "USPS TRACKING # eVS", font=get_font(12, True), fill=(71, 85, 105))
    
    # Barcode bars
    bx = lx1 + 25
    for i in range(48):
        bw = 3 if i % 3 == 0 else (5 if i % 5 == 0 else 2)
        draw.rectangle([(bx, ly1 + 205), (bx + bw, ly1 + 285)], fill=(15, 23, 42))
        bx += bw + 3
        if bx > lx2 - 30:
            break
            
    draw.text((lx1 + 50, ly1 + 295), "9405 5002 0819 2110 5911 23", font=get_font(14, False, True), fill=(15, 23, 42))
    draw.text((lx1 + 25, ly1 + 340), "AutoShip Clover Fulfillment  •  Weight: 2.38 lbs", font=get_font(12), fill=(100, 116, 139))

    # Payment Action Button
    draw.rounded_rectangle([(1220, 845), (1840, 920)], radius=12, fill=MINT_DEEP)
    draw.text((1350, 868), "💳 Take Clover Payment ($145.00) & Print Label", font=get_font(20, True), fill=(255, 255, 255))

    img.save('assets/screenshots/03-free-shipping-promo.png')
    print('Generated assets/screenshots/03-free-shipping-promo.png')

# ==============================================================================
# SCREENSHOT 4: MERCHANT WEB DASHBOARD & STANDALONE LABEL (MIDNIGHT SLATE)
# ==============================================================================
def make_screenshot_4():
    img = Image.new('RGB', (1920, 1080), BG_CANVAS)
    draw = ImageDraw.Draw(img)

    # Top Navigation Bar (Frosted Midnight Glass)
    draw.rectangle([(0, 0), (1920, 80)], fill=BG_HEADER)
    draw.line([(0, 80), (1920, 80)], fill=BORDER_SUBTLE, width=2)
    
    if logo_raw:
        logo_icon = logo_raw.resize((50, 50), Image.Resampling.LANCZOS)
        img.paste(logo_icon, (40, 15), logo_icon)
        draw.text((105, 22), "AutoShip", font=get_font(26, True), fill=BORDER_CYAN)
    else:
        draw.text((40, 22), "AutoShip", font=get_font(26, True), fill=BORDER_CYAN)
        
    draw.text((250, 28), "Clover Merchant Fulfillment Portal", font=get_font(18), fill=TEXT_MUTED)
    
    # Navigation Tabs in Top Bar
    draw.rounded_rectangle([(650, 18), (810, 62)], radius=8, fill=SURFACE_ELEVATED, outline=BORDER_CYAN, width=1)
    draw.text((670, 28), "📦 Fulfillments", font=get_font(15, True), fill=BORDER_CYAN)
    
    draw.rounded_rectangle([(825, 18), (1050, 62)], radius=8, fill=SURFACE_CARD, outline=BORDER_SUBTLE, width=1)
    draw.text((845, 28), "🏷️ Standalone Studio", font=get_font(15), fill=TEXT_MAIN)
    
    draw.rounded_rectangle([(1065, 18), (1220, 62)], radius=8, fill=SURFACE_CARD, outline=BORDER_SUBTLE, width=1)
    draw.text((1085, 28), "⚙️ Settings", font=get_font(15), fill=TEXT_MAIN)

    # Online network indicator
    draw.ellipse([(1640, 36), (1652, 48)], fill=MINT_ACCENT)
    draw.text((1665, 28), "EasyPost API Live  •  v1.0.2", font=get_font(16, True), fill=MINT_ACCENT)

    # Plan Allotment & Quota Card (Width: 1840)
    draw.rounded_rectangle([(40, 105), (1880, 205)], radius=12, fill=SURFACE_CARD, outline=CYAN_PRIMARY, width=1)
    draw.text((70, 125), "Clover Subscription Plan: Growth Plan ($6.99/mo)", font=get_font(20, True), fill=TEXT_MAIN)
    draw.rounded_rectangle([(550, 122), (680, 155)], radius=6, fill=(6, 78, 59), outline=MINT_DEEP, width=1)
    draw.text((565, 128), "ACTIVE PLAN", font=get_font(12, True), fill=MINT_ACCENT)
    
    # Allotment Progress Bar
    draw.rounded_rectangle([(70, 165), (1450, 185)], radius=10, fill=SURFACE_INPUT)
    draw.rounded_rectangle([(70, 165), (460, 185)], radius=10, fill=MINT_DEEP) # 28% used
    draw.text((1480, 164), "28 / 100 Shipments Used (72 Included Remaining  •  $0.00 Metered Charge)", font=get_font(14, True), fill=TEXT_MAIN)

    # KPI Metrics Row (4 Cards)
    kpis = [
        ("Total Shipments", "1,428", "USPS, UPS, FedEx processed", BORDER_CYAN),
        ("Commercial Savings", "$3,842.50", "Pre-negotiated base discount", MINT_ACCENT),
        ("Avg Delivery Speed", "2.4 Days", "AI 3D packaging routing", (245, 158, 11)),
        ("Packaging Presets", "5 Sizes", "Bubble Mailer to XL Box", (192, 132, 252))
    ]
    
    kx = 40
    for title, val, sub, col in kpis:
        draw.rounded_rectangle([(kx, 225), (kx + 440, 345)], radius=12, fill=SURFACE_CARD, outline=BORDER_SUBTLE, width=1)
        draw.text((kx + 30, 245), title, font=get_font(15), fill=TEXT_MUTED)
        draw.text((kx + 30, 270), val, font=get_font(34, True), fill=col)
        draw.text((kx + 30, 315), sub, font=get_font(13), fill=TEXT_SUB)
        kx += 467

    # Recent Shipments Table (Width: 1840, Height: 680)
    draw.rounded_rectangle([(40, 370), (1880, 1040)], radius=14, fill=SURFACE_CARD, outline=BORDER_SUBTLE, width=2)
    draw.text((70, 395), "Recent Clover Orders & Live Thermal Labels", font=get_font(22, True), fill=TEXT_MAIN)

    # Table Header
    headers = [("ORDER ID", 70), ("RECIPIENT", 240), ("DESTINATION", 500), ("CARRIER & SERVICE", 840), ("TRACKING NUMBER", 1200), ("STATUS", 1540), ("ACTIONS", 1730)]
    draw.rectangle([(70, 435), (1850, 475)], fill=SURFACE_ELEVATED)
    for h_text, hx in headers:
        draw.text((hx, 446), h_text, font=get_font(13, True), fill=TEXT_MUTED)

    rows = [
        ("#C9X8821", "Sarah Jenkins", "Springfield, OR 97477", "USPS Ground Advantage", "9405 5002 0819 2110 5911 23", "DELIVERED", MINT_ACCENT),
        ("#C9X8820", "Michael Chang", "Austin, TX 78701", "UPS Ground®", "1Z9999999292999991", "IN TRANSIT", BORDER_CYAN),
        ("#C9X8819", "Emily Davis", "Seattle, WA 98101", "FedEx Home Delivery®", "7948 1123 9982", "IN TRANSIT", BORDER_CYAN),
        ("#C9X8818", "Robert Martinez", "Denver, CO 80202", "USPS Priority Mail®", "9405 5002 8882 1123 4401 12", "DELIVERED", MINT_ACCENT),
        ("#C9X8817", "Amanda Taylor", "Chicago, IL 60601", "UPS 2nd Day Air®", "1Z9999990200112233", "DELIVERED", MINT_ACCENT),
        ("#C9X8816", "David Wilson", "Miami, FL 33101", "USPS Ground Advantage", "9405 5002 4455 6677 8899 01", "LABEL READY", (245, 158, 11)),
        ("#STANDALONE-4", "Jameson Blake", "Phoenix, AZ 85001", "USPS Priority Mail®", "9405 5002 7711 3344 5566 77", "IN TRANSIT", BORDER_CYAN)
    ]

    ry = 485
    for oid, recip, dest, serv, track, stat, scol in rows:
        draw.line([(70, ry), (1850, ry)], fill=BORDER_SUBTLE, width=1)
        draw.text((70, ry + 18), oid, font=get_font(16, True), fill=BORDER_CYAN if "STANDALONE" in oid else TEXT_MAIN)
        draw.text((240, ry + 18), recip, font=get_font(16), fill=TEXT_MAIN)
        draw.text((500, ry + 18), dest, font=get_font(15), fill=TEXT_MUTED)
        draw.text((840, ry + 18), serv, font=get_font(16, True), fill=TEXT_MAIN)
        draw.text((1200, ry + 18), track, font=get_font(15, False, True), fill=BORDER_CYAN)
        
        # Status Pill
        draw.rounded_rectangle([(1530, ry + 12), (1665, ry + 44)], radius=6, fill=SURFACE_INPUT, outline=scol, width=1)
        draw.text((1545, ry + 18), stat, font=get_font(12, True), fill=scol)
        
        # Action Button: Print 4x6 Label
        draw.rounded_rectangle([(1720, ry + 12), (1845, ry + 46)], radius=6, fill=SURFACE_ELEVATED, outline=BORDER_CYAN, width=1)
        draw.text((1735, ry + 18), "🏷️ 4\"×6\" Label", font=get_font(13, True), fill=BORDER_CYAN)
        ry += 68

    img.save('assets/screenshots/04-merchant-web-dashboard.png')
    print('Generated assets/screenshots/04-merchant-web-dashboard.png')

# ==============================================================================
# SCREENSHOT 5: CLOVER FLEX HANDHELD RESPONSIVE VIEW (MIDNIGHT SLATE)
# ==============================================================================
def make_screenshot_5():
    img = Image.new('RGB', (1920, 1080), BG_CANVAS)
    draw = ImageDraw.Draw(img)
    draw_clover_top_bar(img, draw, "Clover Flex Handheld Terminal View", "Responsive 360dp Viewport  •  One-Thumb Ergonomics")

    # Left: Clover Flex Hardware Mockup Frame
    fx1, fy1, fx2, fy2 = 120, 180, 580, 1030
    draw.rounded_rectangle([(fx1, fy1), (fx2, fy2)], radius=36, fill=(15, 23, 42), outline=(56, 189, 248), width=3)
    
    # Flex Screen Area (360dp * 2 = 720x1280 styled to fit inner frame 420x800)
    sx1, sy1, sx2, sy2 = fx1 + 20, fy1 + 35, fx2 - 20, fy2 - 35
    draw.rounded_rectangle([(sx1, sy1), (sx2, sy2)], radius=18, fill=BG_CANVAS)
    
    # Handheld App Header
    draw.rectangle([(sx1, sy1), (sx2, sy1 + 55)], fill=BG_HEADER)
    draw.line([(sx1, sy1 + 55), (sx2, sy1 + 55)], fill=BORDER_SUBTLE, width=1)
    draw.text((sx1 + 15, sy1 + 18), "AutoShip", font=get_font(18, True), fill=BORDER_CYAN)
    draw.text((sx1 + 105, sy1 + 20), "#K194 • 3 Items", font=get_font(14), fill=TEXT_MUTED)
    
    # Handheld Address Card
    ay = sy1 + 68
    draw.rounded_rectangle([(sx1 + 12, ay), (sx2 - 12, ay + 115)], radius=8, fill=SURFACE_CARD, outline=BORDER_SUBTLE, width=1)
    draw.text((sx1 + 22, ay + 12), "📍 Ship To: Sarah Jenkins", font=get_font(15, True), fill=TEXT_MAIN)
    draw.text((sx1 + 22, ay + 38), "742 Evergreen Terrace, Ste 4B", font=get_font(13), fill=TEXT_MUTED)
    draw.text((sx1 + 22, ay + 60), "Springfield, OR 97477", font=get_font(13), fill=TEXT_MUTED)
    draw.text((sx1 + 22, ay + 86), "✓ USPS Validated (Zone 4)", font=get_font(12, True), fill=MINT_ACCENT)

    # Handheld Carrier Rate List (Scrollable items)
    ry = ay + 130
    h_rates = [
        ("USPS Ground Adv.", "2-5 Days", "$7.85", True, BORDER_CYAN),
        ("USPS Priority Mail", "1-3 Days", "$11.40", False, BORDER_SUBTLE),
        ("UPS Ground®", "2 Days", "$9.95", False, BORDER_SUBTLE),
        ("FedEx Home Deliv.", "2-4 Days", "$10.25", False, BORDER_SUBTLE)
    ]
    
    for s_name, s_eta, s_price, s_sel, s_border in h_rates:
        card_col = SURFACE_ELEVATED if s_sel else SURFACE_CARD
        draw.rounded_rectangle([(sx1 + 12, ry), (sx2 - 12, ry + 68)], radius=8, fill=card_col, outline=s_border, width=2 if s_sel else 1)
        
        # Radio circle
        draw.ellipse([(sx1 + 24, ry + 24), (sx1 + 44, ry + 44)], outline=BORDER_CYAN if s_sel else TEXT_SUB, width=2)
        if s_sel:
            draw.ellipse([(sx1 + 28, ry + 28), (sx1 + 40, ry + 40)], fill=BORDER_CYAN)
            
        draw.text((sx1 + 54, ry + 14), s_name, font=get_font(15, True), fill=TEXT_MAIN)
        draw.text((sx1 + 54, ry + 38), s_eta, font=get_font(13), fill=TEXT_MUTED)
        draw.text((sx2 - 95, ry + 20), s_price, font=get_font(18, True), fill=BORDER_CYAN if s_sel else TEXT_MAIN)
        ry += 76

    # Handheld Insurance Row
    draw.rounded_rectangle([(sx1 + 12, ry), (sx2 - 12, ry + 55)], radius=8, fill=(12, 43, 78), outline=CYAN_PRIMARY, width=1)
    draw.text((sx1 + 22, ry + 12), "🛡️ Insurance: +$1.35", font=get_font(14, True), fill=BORDER_CYAN)
    draw.text((sx1 + 22, ry + 32), "100% Package Replacement", font=get_font(12), fill=TEXT_MUTED)
    draw.text((sx2 - 80, ry + 18), "[ ON ✓ ]", font=get_font(13, True), fill=MINT_ACCENT)

    # Handheld Sticky Bottom Bar
    draw.rounded_rectangle([(sx1 + 8, sy2 - 62), (sx2 - 8, sy2 - 8)], radius=8, fill=MINT_DEEP)
    draw.text((sx1 + 50, sy2 - 44), "Add to Order  ($9.20)  ➔", font=get_font(16, True), fill=(255, 255, 255))

    # Right: Feature Callout Cards
    features = [
        ("📱 Optimized for Clover Flex 360dp Viewport", 
         "Custom-engineered layouts adapt seamlessly to Clover Flex handheld devices without clipping or horizontal overflow.",
         BORDER_CYAN),
        ("⚡ One-Thumb Reachability & Soft-Keyboard Avoidance", 
         "All modal address fields adjust dynamically with `adjustResize` soft-keyboard behavior so the cashier never loses focus on action buttons.",
         MINT_ACCENT),
        ("🏷️ Instant 4\"×6\" Thermal Label Generation", 
         "Prints genuine carrier shipping labels with live tracking codes directly upon payment swipe or order completion.",
         (245, 158, 11)),
        ("🛡️ Standalone Label Creation Studio", 
         "Full ability to calculate rates and buy shipping postage from scratch without requiring an open Register cart.",
         (192, 132, 252))
    ]

    fy = 220
    for title, desc, col in features:
        draw.rounded_rectangle([(650, fy), (1850, fy + 160)], radius=14, fill=SURFACE_CARD, outline=BORDER_SUBTLE, width=1)
        draw.rounded_rectangle([(650, fy), (660, fy + 160)], radius=4, fill=col)
        draw.text((690, fy + 26), title, font=get_font(22, True), fill=col)
        draw.text((690, fy + 70), desc, font=get_font(17), fill=TEXT_MAIN)
        fy += 190

    img.save('assets/screenshots/05-clover-flex-handheld.png')
    print('Generated assets/screenshots/05-clover-flex-handheld.png')

make_screenshot_1()
make_screenshot_2()
make_screenshot_3()
make_screenshot_4()
make_screenshot_5()
print("All 5 store screenshots successfully generated in Midnight Slate & Velocity Mint!")
