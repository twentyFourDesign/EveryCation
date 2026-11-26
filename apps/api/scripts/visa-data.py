"""Converts passport-index-tidy-iso2.csv into data/visa.json. Usage: python3 scripts/visa-data.py FILE.csv YYYY-MM-DD"""
import csv, json, sys
src, updated = sys.argv[1], sys.argv[2]
enc = {'visa free': 'f', 'visa on arrival': 'a', 'eta': 't', 'e-visa': 'e', 'visa required': 'v', 'no admission': 'x', '-1': '-'}
rows, dests = {}, set()
for r in csv.DictReader(open(src)):
    p, d, q = r['Passport'].upper(), r['Destination'].upper(), r['Requirement'].strip().lower()
    rows.setdefault(p, {})[d] = q; dests.add(d)
codes = sorted(set(rows) | dests)
out = {p: ','.join('' if (q := rows[p].get(d)) is None else q if q.isdigit() else enc[q] for d in codes) for p in sorted(rows)}
json.dump({'updated': updated, 'source': 'Passport Index data (passportindex.org), via github.com/imorte/passport-index-data, MIT licence', 'codes': codes, 'rows': out},
          open('data/visa.json', 'w'), separators=(',', ':'))
print(f'{len(out)} passports, {len(codes)} destinations')
