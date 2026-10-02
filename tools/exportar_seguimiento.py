"""Publicar una vista documental; no sustituye la caja vigente ni inventa denominadores."""
import argparse
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('semilla', type=Path)
parser.add_argument('--destino', type=Path, default=Path(__file__).resolve().parents[1] / 'data')
args = parser.parse_args()
seed = json.loads(args.semilla.read_text(encoding='utf-8-sig'))
args.destino.mkdir(parents=True, exist_ok=True)

def clean(rows):
    return [{k: v for k, v in r.items() if k not in ('RequestId',)} for r in rows]

summary = {k: clean(seed.get(k, [])) for k in ('Projects', 'Animals', 'Assets', 'Activities', 'Personnel', 'Reviews')}
for project in summary['Projects']:
    names = re.findall(r'\(\*?([A-Z][a-z]+ [a-z]+)\*?\)', project.get('Notes', ''))
    project['ReportedScientificNames'] = list(dict.fromkeys(names))
    project['ReportedGenera'] = list(dict.fromkeys(n.split()[0] for n in names))
    notes = project.get('Notes', '')
    project['ReportedVarieties'] = list(dict.fromkeys(re.findall(r'Cenicaf[ée]\s+1|Castillo\s+2\.0', notes, flags=re.I)))
summary['PopulationPeriods'] = clean(seed.get('PopulationPeriods', []))  # La carga actual no acredita población productiva diaria.
summary['Sources'] = [
    {'Id':'S01', 'Name':'Libro original de ingresos y gastos', 'Cut':'2026-07-31'},
    {'Id':'S02', 'Name':'Transcripción del libro (no sustituye el original)', 'Cut':'2026-07-31'},
    {'Id':'S03', 'Name':'Registro externo de alimentación', 'From':'2026-05-01', 'Cut':'2026-08-03'},
    {'Id':'S04', 'Name':'Actividades y seguimiento mensual', 'From':'2026-08-01', 'Cut':'2026-08-31'},
    {'Id':'S05', 'Name':'Seguimiento actualizado de proyectos', 'Cut':None},
    {'Id':'S06', 'Name':'Funciones y requerimientos del director', 'Cut':'2026-09-27'}
]
summary['Version'] = '2026-10-02.1'
evidence = {k:clean(seed.get(k, [])) for k in ('Production','Feed','Health','Supplies','CashOriginal','CashTranscription','Cash')}
evidence['NarrativeSources'] = [{'Id':name[:3], 'Text':(args.semilla.parent.parent / 'fuentes' / name).read_text(encoding='utf-8-sig')} for name in ('S04-Actividades.txt', 'S05-Seguimiento.txt')]
for name, variable, value in [('seguimiento.js','DATA_SEGUIMIENTO',summary), ('evidencias.js','DATA_EVIDENCIAS',evidence)]:
    (args.destino / name).write_text('// Vista documental generada; originales y propuestas separados.\nwindow.' + variable + ' = ' + json.dumps(value, ensure_ascii=False, separators=(',',':')) + ';\n', encoding='utf-8')
print(json.dumps({k:len(v) for k,v in summary.items() if isinstance(v,list)}))
