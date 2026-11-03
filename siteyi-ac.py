"""Siteyi (dist klasörü) yerel sunucuyla açar: çift tıklayın ya da `py siteyi-ac.py` yazın.

siteyi-ac.bat ile aynı işi yapar; antivirüs .bat dosyasını engellerse bunu kullanın.
Kapatmak için açılan pencereyi kapatın (ya da Ctrl+C).
"""
import functools
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

KLASOR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")


def main():
    if not os.path.exists(os.path.join(KLASOR, "index.html")):
        print("dist klasörü bulunamadı:", KLASOR)
        input("Kapatmak için Enter'a basın...")
        sys.exit(1)

    isleyici = functools.partial(http.server.SimpleHTTPRequestHandler, directory=KLASOR)
    isleyici.log_message = lambda *a: None  # her istek için satır yazmasın

    # 8000 doluysa sıradaki boş kapıyı dene
    for port in range(8000, 8011):
        try:
            sunucu = socketserver.ThreadingTCPServer(("127.0.0.1", port), isleyici)
            break
        except OSError:
            continue
    else:
        print("8000-8010 arasındaki kapıların hepsi dolu.")
        input("Kapatmak için Enter'a basın...")
        sys.exit(1)

    adres = f"http://localhost:{port}/"
    print(f"Site açık: {adres}")
    print("Kapatmak için bu pencereyi kapatın.")
    threading.Timer(0.8, lambda: webbrowser.open(adres)).start()
    try:
        sunucu.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
