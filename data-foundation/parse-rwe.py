#!/usr/bin/env python3
"""RWE 2015 → structured lexeme JSON (v2: tight region, skill-tags, list B)."""
import json, re, sys
from collections import Counter

TXT, OUT = sys.argv[1], sys.argv[2]
LEFT_HDR = re.compile(r'^\s*HK\s+Grundform\s+Wortart')
RIGHT_HDR = re.compile(r'^\s*ig\s+r-Schreibung\s+el,eln,em,en')
A_MARK = re.compile(r'^\s*A\s?\d{1,3}\s*$')
PAGE = re.compile(r'^\s*[ARB]\s?\d{1,3}\s*$')
POS = {'N','V','ADJ','ADV','PRO','KONJ','ART','PREP','PRÄP','PTK','NUM','INTERJ','ADJ / ADV','PRP'}
lines = open(TXT, encoding='utf-8').read().splitlines()
cols = lambda s: re.split(r'\s{2,}', s.strip())

# Appendix A left-header: first header AFTER the first A-page marker (skips the methodology Table 2).
first_a = next(i for i, l in enumerate(lines) if A_MARK.match(l))
start = next(i for i, l in enumerate(lines) if LEFT_HDR.match(l) and i < first_a) \
        if any(LEFT_HDR.match(l) and i < first_a for i, l in enumerate(lines)) \
        else next(i for i, l in enumerate(lines) if LEFT_HDR.match(l))
# List A ends at its last page footer 'A###'; everything after is the reverse list R.
a_start = next(i for i, l in enumerate(lines) if A_MARK.match(l))
last_a = max(i for i, l in enumerate(lines) if A_MARK.match(l))
region = lines[start:last_a + 1]

DBL = re.compile(r'^<(ll|mm|nn|tt|pp|bb|dd|gg|ff|ss|ck|tz|ch|kk|rr|zz|dt)>$')

def left_feat(v, f):
    if '<v>' in v: f['vSchreibung'] = v
    elif '<h>' in v: f['stummesH'] = v
    elif re.search(r'<(aa|ee|oo|ää|ä|öö|ö|üü|ü)>', v): f['doppelvokalUmlaut'] = v
    elif re.search(r'<(g|d|b)>', v): f['auslautverhaertung'] = v

def right_cell(v, r):
    f = r['features']
    if v in ('<ig>', 'ig'): f['ig'] = True
    elif v == '<ß>': f['scharfesS'] = True
    elif v == 'silH' or v == '<silH>': f['silbischesH'] = True
    elif DBL.match(v): f['silbengelenk'] = v
    elif '/' in v and re.search(r'<e?r>', v): f['rSchreibung'] = v
    elif '/' in v and re.search(r'<e[mnl]?n?>', v): f['schwaEnding'] = v
    elif 'Lernwort' in v or 'trennbar' in v or 'Fugen' in v: r['sonstiges'] += ' ' + v
    else: r['schema'] += ' ' + v

# pass 1: LEFT spine
spine, by_lemma, mode = [], {}, None
for line in region:
    if LEFT_HDR.match(line): mode = 'L'; continue
    if RIGHT_HDR.match(line): mode = 'R'; continue
    if PAGE.match(line) or 'regelgeleitet' in line or not line.strip(): continue
    c = cols(line)
    if mode == 'L' and len(c) >= 6 and re.fullmatch(r'\d{1,2}', c[0]) and c[2] in POS and re.fullmatch(r'\d{1,2}', c[3]):
        r = {'lemma': c[1], 'hk': int(c[0]), 'pos': c[2], 'morphemeCount': min(int(c[3]), 9),
             'ipa': c[4], 'syllabification': c[5], 'syllableCount': c[5].count('-') + 1,
             'features': {}, 'schema': '', 'sonstiges': ''}
        for x in c[6:]: left_feat(x, r['features'])
        spine.append(r); by_lemma[c[1]] = r

# pass 2: RIGHT join by trailing Grundform (fold continuations)
mode, last = None, None
for line in region:
    if RIGHT_HDR.match(line): mode = 'R'; last = None; continue
    if LEFT_HDR.match(line): mode = 'L'; continue
    if PAGE.match(line) or 'regelgeleitet' in line or not line.strip(): continue
    if mode != 'R': continue
    c = cols(line)
    if c[-1] in by_lemma:
        last = by_lemma[c[-1]]
        for cell in c[:-1]: right_cell(cell, last)
    elif last is not None:
        for cell in c: right_cell(cell, last)

# list B: 55 Merkwörter (subset of the 2150) → flag isMerkwort
b_lemmas = set()
b_start = next((i for i, l in enumerate(lines) if re.match(r'^\s*B\s?1\s*$', l)), None)
if b_start:
    for line in lines[b_start:]:
        c = cols(line)
        if len(c) >= 2 and re.fullmatch(r'\d{1,2}', c[0]) and c[1]:
            b_lemmas.add(c[1])

VOWEL_LONG = re.compile(r'ː')
def skill_tags(r):
    f, t = r['features'], set()
    sy, n = r['syllabification'], r['syllableCount']
    if n >= 2: t.add('syllable_segmentation'); t.add('syllable_validity')
    if n == 1: t.add('word_raster')
    if VOWEL_LONG.search(r['ipa']) or 'ie' in sy or {'doppelvokalUmlaut','stummesH','silbengelenk'} & set(f):
        t.add('vowel_length')
    if {'stummesH','silbischesH'} & set(f): t.add('dehnung_h')
    if 'silbengelenk' in f: t.add('double_consonant')
    if r.get('genus'): t.add('article')
    if r['pos'] == 'N' and r['morphemeCount'] >= 2: t.add('compound_word')
    if n == 1 and r['pos'] in ('N','ADJ','V'): t.add('vowel_substitution'); t.add('vowel_identify')
    if r.get('forms') or r['morphemeCount'] >= 2: t.add('word_family')
    return sorted(t)

for r in spine:
    schema = r.pop('schema').strip(); son = r.pop('sonstiges').strip()
    m = re.match(r'^(der|die|das)\b[;,]?\s*(.*)$', schema)
    r['genus'] = m.group(1) if m else None
    rest = (m.group(2) if m else schema).strip()
    sep = re.search(r'\((ab|an|auf|aus|ein|mit|nach|vor|zu|um|bei|los|weg|zurück|dar|her|hin|über|unter|durch|fest|frei|hoch|nieder|voran|zusammen)\)', schema)
    r['separablePrefix'] = sep.group(1) if sep else None
    r['forms'] = (rest[:100] or None)
    r['isLernwort'] = 'Lernwort' in son
    r['isTrennbar'] = ('trennbar' in son) or (r['separablePrefix'] is not None)
    r['isMerkwort'] = r['lemma'] in b_lemmas
    r['skillTags'] = skill_tags(r)
    r['source'] = 'rwe2015'

# dedupe (keep first)
seen, uniq = set(), []
for r in spine:
    if r['lemma'] in seen: continue
    seen.add(r['lemma']); uniq.append(r)

json.dump(uniq, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'region lines[{start}:{last_a+1}]  |  parsed {len(spine)}  unique {len(uniq)}  merkwörter {len(b_lemmas)} (matched {sum(r["isMerkwort"] for r in uniq)})')
print('POS:', dict(Counter(r['pos'] for r in uniq).most_common()))
print('features:', dict(Counter(k for r in uniq for k in r['features'])))
print('skillTags:', dict(Counter(t for r in uniq for t in r['skillTags']).most_common()))
print('no-skill rows:', sum(not r['skillTags'] for r in uniq))
for w in ['fahren','Jahr','kommen','Wasser','Abstieg','sehen','Straße','viel']:
    r = next((x for x in uniq if x['lemma'] == w), None)
    print(' ', w, '->', {k: r[k] for k in ('hk','syllabification','genus','skillTags')} if r else 'MISSING', list(r['features']) if r else '')
