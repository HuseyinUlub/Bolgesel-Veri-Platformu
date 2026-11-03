"""UTM (WGS84) → boylam/enlem. İlçe sınırları (eski data.zip/harita.geojson) UTM 36K (metre) koordinatlıdır."""
import math

A = 6378137.0
F = 1 / 298.257223563
K0 = 0.9996
E2 = F * (2 - F)
EP2 = E2 / (1 - E2)


def utm_to_lonlat(x, y, zone=36):
    x -= 500000.0
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    m = y / K0
    mu = m / (A * (1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256))
    e1 = (1 - math.sqrt(1 - E2)) / (1 + math.sqrt(1 - E2))
    p = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu) + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
         + (151 * e1**3 / 96) * math.sin(6 * mu) + (1097 * e1**4 / 512) * math.sin(8 * mu))
    s, c, t = math.sin(p), math.cos(p), math.tan(p)
    n = A / math.sqrt(1 - E2 * s * s)
    r = A * (1 - E2) / (1 - E2 * s * s) ** 1.5
    d = x / (n * K0)
    c1 = EP2 * c * c
    t1 = t * t
    lat = p - (n * t / r) * (d**2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * EP2) * d**4 / 24
                             + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * EP2 - 3 * c1**2) * d**6 / 720)
    lon = lon0 + (d - (1 + 2 * t1 + c1) * d**3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * EP2 + 24 * t1**2) * d**5 / 120) / c
    return math.degrees(lon), math.degrees(lat)


def donustur(coords, zone=36, nd=4):
    if isinstance(coords[0], (int, float)):
        lon, lat = utm_to_lonlat(coords[0], coords[1], zone)
        return [round(lon, nd), round(lat, nd)]
    return [donustur(c, zone, nd) for c in coords]
