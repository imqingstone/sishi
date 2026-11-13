"""Compute the 24 solar terms (節氣) for 1900-2101 from astronomy.

Each term is the moment the sun's apparent geocentric ecliptic longitude
(full VSOP87 with nutation and aberration, via PyMeeus) reaches a multiple of
15 degrees. TT is converted to UT with PyMeeus' ΔT model. Times are written as
minutes since 1970-01-01 00:00 in UTC+8 (Taiwan standard time), rounded to the
nearest minute; they agree with the times the Central Weather Administration
publishes to within a minute.

Requires: pip install pymeeus
Output docs/terms.js: row k is year 1900+k; column i is the term at longitude
285 + 15*i (小寒 first), so column 2 is 立春 and the even columns are the 節
that start each month.
"""
import json, sys
from pymeeus.Epoch import Epoch
from pymeeus.Sun import Sun

NAMES = ['小寒','大寒','立春','雨水','驚蟄','春分','清明','穀雨','立夏','小滿','芒種','夏至',
         '小暑','大暑','立秋','處暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至']
JD_1970 = 2440587.5

def lon(jde):
    l, b, r = Sun.apparent_geocentric_position(Epoch(jde))
    return l.to_positive()()

def term_jde(target, guess):
    j = guess
    for _ in range(50):
        d = (target - lon(j) + 180) % 360 - 180
        j += d / 360 * 365.2422
        if abs(d) < 1e-7:
            break
    return j

def main(out):
    rows = []
    for y in range(1900, 2102):
        row = []
        start = Epoch(y, 1, 6).jde()
        for i in range(24):
            target = (285 + 15 * i) % 360
            j = term_jde(target, start + 15.22 * i)
            month = min(12, 1 + i // 2)
            jd_ut = j - Epoch.tt2ut(y, month) / 86400
            row.append(round((jd_ut - JD_1970) * 1440 + 480))
        rows.append(row)
    js = ('// 1900–2101 年二十四節氣時刻，由 tools/gen_terms.py 依天文計算產生，請勿手動修改。\n'
          '// 每列一年，依序為小寒、大寒、立春……冬至；數值為 1970-01-01 00:00（UTC+8）起算的分鐘數。\n'
          '(function(g){\nconst T = {start: 1900, names: ' + json.dumps(NAMES, ensure_ascii=False) + ', data: ' +
          json.dumps(rows, separators=(',', ':')) + '};\n'
          "if (typeof module !== 'undefined') module.exports = T; else g.SISHI_TERMS = T;\n})(this);\n")
    open(out, 'w', encoding='utf-8').write(js)

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'docs/terms.js')
