import pdfplumber,re,sys
SPECIAL={247:'ğ',124:'ö',213:'ı',250:'ş',248:'İ',129:'ü',111:'ç',103:'Ö',100:'Ç'}
def ch_text(t):
    m=re.fullmatch(r'\(cid:(\d+)\)',t)
    if not m: return t
    n=int(m.group(1))
    if n in SPECIAL: return SPECIAL[n]
    return chr(n+29) if n+29<127 else '?'
def sayfa_metni(pg):
    """Karakterleri satırlara toplar: dikey merkezleri yazı boyunun yarısından yakın olanlar aynı satırdır."""
    satirlar = []
    for c in sorted(pg.chars, key=lambda c: (c["top"] + c["bottom"]) / 2):
        m = (c["top"] + c["bottom"]) / 2
        if satirlar and abs(m - satirlar[-1][0]) <= c["size"] * 0.55:
            satirlar[-1][1].append(c)
        else:
            satirlar.append([m, [c]])
    lines = []
    for _, cs in satirlar:
        cs.sort(key=lambda c: c["x0"]); s = ""; last = None
        for c in cs:
            if last is not None and c["x0"] - last > c["size"] * 0.25:
                s += " "
            s += ch_text(c["text"]); last = c["x1"]
        lines.append(s)
    return "\n".join(lines)


if __name__=='__main__':
    f,a,b=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
    with pdfplumber.open(f) as pdf:
        print('\f'.join(sayfa_metni(pdf.pages[i]) for i in range(a-1,b)))
