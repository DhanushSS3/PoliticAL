import pandas as pd
from pathlib import Path
import re

# --- CONFIGURATION ---
BASE = Path(r"C:\Users\user\movies\PoliticAI")
CENSUS_PATH = BASE / "DDW29C-01 MDDS.XLS"
MAPPING_PATH = BASE / "Constituency_Taluk_Mapping (1).xlsx"
OUTPUT_PATH = BASE / "constituency_religion.csv"

YEAR = 2011
SOURCE = "Census 2011 (taluk-weighted)"

def find_col(df: pd.DataFrame, *tokens: str) -> str:
    tokens = [t.lower() for t in tokens]
    for col in df.columns:
        text = str(col).lower()
        if all(t in text for t in tokens):
            return col
    raise KeyError(f"Could not find column with tokens {tokens}")

def normalize_name(s: str) -> str:
    if pd.isna(s): return ""
    s = str(s).lower()
    # 1. Remove (SC) and (ST) suffixes
    s = re.sub(r'\(sc\)|\(st\)', '', s)
    # 2. Extract name after dash if present (Census style: Sub-District - Name)
    if " - " in s: s = s.split(" - ")[-1]
    # 3. Remove all non-alphanumeric characters (spaces, dots, dashes)
    s = re.sub(r'[^a-z0-9]', '', s)
    # 4. Remove administrative suffixes
    for t in ["taluk", "taluka", "tq", "talq", "tal"]:
        if s.endswith(t): s = s[:-len(t)]
    return s.strip()

def main():
    print(">>> SCRIPT STARTED <<<")
    census = pd.read_excel(CENSUS_PATH)

    # 1. Identify Census Columns
    level_col = find_col(census, "level")
    tru_col = find_col(census, "tru")
    state_code_col = find_col(census, "state", "code")
    taluk_name_col = find_col(census, "sub-district", "name")

    religion_cols = {
        "Hindu": find_col(census, "hindus", "persons"),
        "Muslim": find_col(census, "muslims", "persons"),
        "Christian": find_col(census, "christians", "persons"),
        "Sikh": find_col(census, "sikhs", "persons"),
        "Buddhist": find_col(census, "buddhists", "persons"),
        "Jain": find_col(census, "jains", "persons"),
    }

    # 2. Clean Census Data
    is_subdistrict = census[level_col].astype(str).str.contains("sub-district", case=False, na=False)
    is_total_tru = census[tru_col].astype(str).str.startswith(("t", "T", "total"), na=False)
    taluks = census[is_subdistrict & is_total_tru].copy()

    taluks["state_code"] = taluks[state_code_col].astype(int)
    taluks["taluk_norm"] = taluks[taluk_name_col].apply(normalize_name)

    # 3. Load Mapping & Apply Proxies
    mapping = pd.read_excel(MAPPING_PATH)
    
    # Specific proxies for your missing constituencies
    proxies = {
        "kudachi": "raibag",
        "raybag": "raibag",
        "kittur": "bailhongal",
        "bailhongal": "bailhongal",
        "hublidharwadcentral": "hubli",
        "saundatti": "parasgad", # Saundatti was 'Parasgad' in 2011 Census
    }

    def get_effective_key(name):
        norm = normalize_name(name)
        return proxies.get(norm, norm)

    mapping["taluk_norm"] = mapping["taluk_name"].apply(get_effective_key)
    mapping["state_code"] = mapping["state_code"].astype(int)

    # 4. Merge
    merged = pd.merge(mapping, taluks, how="left", on=["state_code", "taluk_norm"])

    # 5. Allocate Populations
    for rel, col in religion_cols.items():
        merged[col] = pd.to_numeric(merged[col], errors="coerce").fillna(0)
        merged[f"{rel}_alloc"] = merged[col] * merged["share_of_taluk_in_constituency"]

    # 6. Aggregate by Constituency
    alloc_cols = [f"{rel}_alloc" for rel in religion_cols.keys()]
    agg = merged.groupby(["constituency_name"])[alloc_cols].sum().reset_index()
    agg["total_population"] = agg[alloc_cols].sum(axis=1)

    # 7. Reshape to Long Format
    records = []
    for rel in religion_cols.keys():
        tmp = agg[["constituency_name"]].copy()
        tmp["year"] = YEAR
        tmp["source"] = SOURCE
        tmp["religion"] = rel
        tmp["population"] = agg[f"{rel}_alloc"].round().astype(int)
        tmp["percent"] = (agg[f"{rel}_alloc"] / agg["total_population"] * 100).fillna(0)
        records.append(tmp)

    final = pd.concat(records, ignore_index=True)
    final.to_csv(OUTPUT_PATH, index=False)
    print(f">>> SUCCESS: File saved to {OUTPUT_PATH} <<<")

if __name__ == "__main__":
    main()