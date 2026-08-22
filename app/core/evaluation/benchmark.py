import pandas as pd
def benchmark(generated,expected):
 key="Mfg_Part_Num"
 if key not in generated or key not in expected: return {"available":False,"message":"Benchmark key unavailable."}
 g=generated.copy().fillna(""); e=expected.copy().fillna(""); g=g.set_index(key);e=e.set_index(key); common=[k for k in e.index if k in g.index and str(k).strip()]
 fields=[c for c in e.columns if c in g.columns]; scores=[]
 for c in fields:
  vals=[str(g.loc[k,c]).strip().lower()==str(e.loc[k,c]).strip().lower() for k in common]
  if vals: scores.append({"field":c,"score":round(sum(vals)/len(vals)*100,1)})
 overall=round(sum(x["score"] for x in scores)/len(scores),1) if scores else 0
 return {"available":bool(common),"rows":len(common),"fields":len(scores),"overall":overall,"scores":scores}
