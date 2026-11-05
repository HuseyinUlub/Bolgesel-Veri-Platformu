# Dokploy / herhangi bir Docker ortamı için: depodaki hazır dist/ klasörünü nginx ile sunar.
# Site güncellemek için: npm run build (ya da hepsini_olustur.py --site) → dist/ commit + push → Dokploy yeniden deploy.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
