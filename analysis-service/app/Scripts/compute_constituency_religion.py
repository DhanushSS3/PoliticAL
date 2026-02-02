# import pandas as pd
# from pathlib import Path

# BASE = Path(r"C:\Users\user\movies\PoliticAI")

# CENSUS_PATH = BASE / "DDW29C-01 MDDS.XLS"
# MAPPING_PATH = BASE / "Constituency_Taluk_Mapping (1).xlsx"
# OUTPUT_PATH = BASE / "constituency_religion.csv"

# YEAR = 2011
# SOURCE = "Census 2011 (taluk-weighted)"


# def find_col(df: pd.DataFrame, *tokens: str) -> str:
#     """
#     Find first column whose header contains ALL tokens (case-insensitive).
#     Raises if not found, so you notice quickly.
#     """
#     tokens = [t.lower() for t in tokens]
#     for col in df.columns:
#         text = str(col).lower()
#         if all(t in text for t in tokens):
#             return col
#     raise KeyError(f"Could not find column with tokens {tokens}")


# def normalize_name(s: str) -> str:
#     if pd.isna(s):
#         return ""
#     s = str(s).strip().lower()
#     # remove common suffixes
#     for token in [" taluk", " taluka", " tq", " tq.", " talq", " tal"]:
#         if s.endswith(token):
#             s = s[: -len(token)]
#     # collapse multiple spaces
#     s = " ".join(s.split())
#     return s


# def main():
#     # 1) Read census file
#     census = pd.read_excel(CENSUS_PATH)

#     # 2) Identify key columns by pattern based on C-1 layout
#     # Geography / identifiers
#     state_code_col = find_col(census, "state", "code")          # e.g. ("State", "Code")
#     area_name_col = find_col(census, "area", "name")            # "Area Name"

#     # Total / Rural / Urban flag. Some files use "TRU", some use full text.
#     try:
#         tru_col = find_col(census, "tru")
#     except KeyError:
#         tru_col = find_col(census, "total", "rural", "urban")

#     # 3) Religion columns (Persons only) - ignore sex splits
#     religion_cols = {
#         "HINDU":      find_col(census, "hindus", "persons"),
#         "MUSLIM":     find_col(census, "muslims", "persons"),
#         "CHRISTIAN":  find_col(census, "christians", "persons"),
#         "SIKH":       find_col(census, "sikhs", "persons"),
#         "BUDDHIST":   find_col(census, "buddhists", "persons"),
#         "JAIN":       find_col(census, "jains", "persons"),
#         "OTHER":      find_col(census, "other religions", "persons"),
#         "NOT_STATED": find_col(census, "religion not stated", "persons"),
#     }

#     # 4) Keep only Sub-District rows as taluks and only TOTAL (not rural/urban splits)
#     # Area Name examples:
#     #   "State - KARNATAKA"        -> ignore
#     #   "District - BELAGAVI"     -> ignore
#     #   "Sub-District - NIPANI"   -> use (taluk)
#     area_series = census[area_name_col].astype(str)
#     is_subdistrict = area_series.str.lower().str.startswith("sub-district -")

#     is_total_tru = census[tru_col].astype(str).str.lower().str.startswith("t")

#     taluks = census[is_subdistrict & is_total_tru].copy()

#     # 5) Normalize keys in census
#     taluks["state_code"] = taluks[state_code_col].astype(int)

#     # Remove the "Sub-District - " prefix from Area Name and normalize to match mapping taluk_name
#     taluks["taluk_name_norm"] = (
#         taluks[area_name_col]
#         .astype(str)
#         .str.replace(r"(?i)^sub-district\s*-\s*", "", regex=True)
#         .apply(normalize_name)
#     )

#     # 6) Read and normalize mapping file
#     mapping = pd.read_excel(MAPPING_PATH)

#     mapping["state_code"] = mapping["state_code"].astype(int)
#     mapping["taluk_name_norm"] = mapping["taluk_name"].apply(normalize_name)

#     # 7) Inner join: only taluks that are mapped to constituencies
#     # Join on state_code + normalized taluk name. District name is taken from mapping.
#     merged = pd.merge(
#         taluks,
#         mapping,
#         how="inner",
#         on=["state_code", "taluk_name_norm"],
#         suffixes=("_census", "_map"),
#     )

#     # Optional: show taluks in census that did NOT match mapping
#     missing = taluks.merge(
#         mapping[["state_code", "taluk_name_norm"]],
#         how="left",
#         on=["state_code", "taluk_name_norm"],
#         indicator=True,
#     )
#     missing = missing[missing["_merge"] == "left_only"]
#     if not missing.empty:
#         print("WARNING: some taluks in census are not in the mapping file. Top 20:")
#         print(
#             missing[
#                 [state_code_col, area_name_col]
#             ].drop_duplicates().head(20)
#         )

#     # 8) Allocate religion counts from taluks to constituencies
#     for rel, col in religion_cols.items():
#         merged[col] = pd.to_numeric(merged[col], errors="coerce").fillna(0)
#         merged[f"{rel}_alloc"] = merged[col] * merged["share_of_taluk_in_constituency"]

#     # 9) Aggregate by constituency
#     # 8) Aggregate by constituency
#     alloc_cols = [f"{rel}_alloc" for rel in religion_cols.keys()]
#     group_cols = ["state_code", "district_name", "constituency_name"]

#     agg = (
#         merged.groupby(group_cols, dropna=False)[alloc_cols]
#         .sum()
#         .reset_index()
#     )

#     # 9) Total population and percents
#     agg["total_population"] = agg[alloc_cols].sum(axis=1)

#     for rel in religion_cols.keys():
#         agg[f"{rel}_percent"] = 100.0 * agg[f"{rel}_alloc"] / agg["total_population"]

#     # 10) Long format for import
#     records = []
#     for rel in religion_cols.keys():
#         tmp = agg[["state_code", "district_name", "constituency_name"]].copy()
#         tmp["year"] = YEAR
#         tmp["source"] = SOURCE
#         tmp["religion"] = rel
#         tmp["population"] = agg[f"{rel}_alloc"].round().astype(int)
#         tmp["percent"] = agg[f"{rel}_percent"]
#         records.append(tmp)

#     final = pd.concat(records, ignore_index=True)

#     final.to_csv(OUTPUT_PATH, index=False, encoding="utf-8")
#     print(f"Written {len(final)} rows to {OUTPUT_PATH}")


# if __name__ == "__main__":
#     main()
import pandas as pd
import numpy as np
from pathlib import Path
import re
from rapidfuzz import process
# --- CONFIGURATION ---
BASE = Path(r"C:\Users\user\movies\PoliticAI\analysis-service\app\Scripts")
CENSUS_PATH = BASE / "DDW29C-01 MDDS.XLS"
MAPPING_PATH = BASE / "Constituency_Taluk_Mapping (1).xlsx"
OUTPUT_PATH = BASE / "constituency_religion.csv"

YEAR = 2011
SOURCE = "Census 2011 (taluk-weighted)"

def normalize_name(s: str) -> str:
    if pd.isna(s): return ""
    s = str(s).strip().lower()
    # 1. Remove prefixes like "sub-district - " or "district - "
    if " - " in s:
        s = s.split(" - ")[-1]
    # 2. Remove all non-alphanumeric characters (dots, dashes, spaces)
    s = re.sub(r'[^a-z0-9]', '', s)
    # 3. Strip common administrative suffixes
    for t in ["taluk", "taluka", "tq", "tq", "talq", "tal", "sc", "st"]:
        if s.endswith(t):
            s = s[:-len(t)]
    return s.strip()

def main():
    print(">>> SCRIPT STARTED <<<")
    
    # 1. LOAD CENSUS DATA
    census = pd.read_excel(CENSUS_PATH, skiprows=7, header=None)
    census_clean = census.iloc[:, [5, 6, 7, 10, 13, 16, 19, 22, 25]].copy()
    census_clean.columns = ["raw_taluk", "level", "total_pop", "hindu", "muslim", "christian", "sikh", "buddhist", "jain"]
    census_clean = census_clean[census_clean["level"].str.contains("Total", na=False, case=False)].copy()
    census_clean = census_clean[census_clean["raw_taluk"].str.contains("Sub-District", na=False)].copy()
    census_clean["taluk_norm"] = census_clean["raw_taluk"].apply(normalize_name)
    census_list = census_clean["taluk_norm"].unique()

    # 2. LOAD MAPPING
    mapping = pd.read_excel(MAPPING_PATH)

    # 3. PROXY FOR NEW TALUKS (Created post-2011)
    # Mapping new taluk names to their 2011 Parent Taluk names
# 3. EXPANDED PROXY MAPPING (2011 Census alignment)
    # 3. EXPANDED PROXY MAPPING (2011 Census alignment)
    proxies = {
        # --- New Rural Taluks ---
        "Nippani": "Chikodi",
        "Kagwad": "Athni",
        "Mudalgi": "Gokak",
        "Kittur": "Bailhongal",
        "Bailhongal": "Bail Hongal", 
        "Saundatti": "Parasgad",           # In 2011, Saundatti was 'Parasgad'
        "Rabkavi Banhatti": "Jamkhandi",
        "Devara Hippargi": "Sindgi",
        "Babaleshwar": "Bijapur",
        "Vijayapura": "Bijapur",
        "Kanakagiri": "Gangawati",
        "Kampli": "Hosapete",
        "Kudachi": "Raibag",
        "Byndoor": "Kundapura",
        "Mayakonda": "Davangere",
        "Gurmitkal": "Yadgir",

        # --- Bengaluru Urban (Mapped to 2011 Sub-Districts) ---
        "Yelahanka": "Bangalore North",
        "Byatarayanapura": "Bangalore North",
        "Yeshvanthapura": "Bangalore North",
        "Dasarahalli": "Bangalore North",
        "Mahalakshmi Layout": "Bangalore North",
        "Malleshwaram": "Bangalore North",
        "Hebbal": "Bangalore North",
        "Pulakeshinagar": "Bangalore North",
        "C.V. Raman Nagar": "Bangalore North",
        "Shivajinagar": "Bangalore North",
        "Shanti Nagar": "Bangalore South",
        "Gandhi Nagar": "Bangalore South",
        "Rajaji Nagar": "Bangalore South",
        "Govindraj Nagar": "Bangalore South",
        "Vijay Nagar": "Bangalore South",
        "Chamrajpet": "Bangalore South",
        "Chickpet": "Bangalore South",
        "Basavanagudi": "Bangalore South",
        "Padmanaba Nagar": "Bangalore South",
        "B.T.M.Layout": "Bangalore South",
        "Jayanagar": "Bangalore South",
        "Mahadevapura": "Bangalore East",
        "Bommanahalli": "Bangalore South",
        "Rajarajeshwarinagar": "Bangalore South",

        # --- Other City Areas ---
        "Hubli-Dharwad Central": "Hubli",
        "Hubli-Dharwad East": "Hubli",
        "Hubli-Dharwad West": "Hubli",
        "Mysuru": "Mysore",
        "Kalaburagi": "Gulbarga",
        "Ballari": "Bellary",
        "Belagavi": "Belgaum",

"Bailhongal": "Bail Hongal",         # Census: 'Bail Hongal' (with space)
        "Kittur": "Bail Hongal",             # Parent Taluk
        "Kudachi (SC)": "Raibag",            # Parent Taluk (Census spelling 'Raibag')
        "Kudachi": "Raibag",
        "Raybag (SC)": "Raibag",             # Normalizing 'Raybag' to Census 'Raibag'
        "Raybag": "Raibag",
        "Raibag": "Raibag",
        "Nippani": "Chikodi",
        
        # --- Dharwad/Hubli Fixes ---
        "Hubli-Dharwad Central": "Hubli",    # Mapped to 'Hubli' or 'Hubli-Dharwad'
        "Hubli-Dharwad-Central": "Hubli",
        "Hubli-Dharwad East": "Hubli",
        "Hubli-Dharwad West": "Hubli",

        # --- Others from your list ---
        "Moodabidri": "Mangalore",
        "Sullia": "Sulya",                   # Census: 'Sulya'
        "Sullia (SC)": "Sulya",
        "Sarvagnanagar": "Bangalore North",
        "Saundatti": "Parasgad",             # Census: 'Parasgad'
    
    }
    mapping["effective_name"] = mapping["taluk_name"].replace(proxies)

    # 4. FUZZY MATCHING
    print("Fuzzy matching taluks (including proxies)...")
    def get_best_match(name):
        norm = normalize_name(name)
        match = process.extractOne(norm, census_list, score_cutoff=85)
        return match[0] if match else None

    unique_taluks = mapping["effective_name"].unique()
    lookup = {name: get_best_match(name) for name in unique_taluks if pd.notna(name)}
    mapping["taluk_norm"] = mapping["effective_name"].map(lookup)

    # 5. MERGE & CALCULATE
    merged = mapping.merge(census_clean, on="taluk_norm", how="left")
    
    # 6. WEIGHTED VALUES
    religions = ["hindu", "muslim", "christian", "sikh", "buddhist", "jain"]
    for rel in religions:
        merged[f"{rel}_w"] = pd.to_numeric(merged[rel], errors='coerce').fillna(0) * merged["share_of_taluk_in_constituency"]
    merged["total_pop_w"] = pd.to_numeric(merged["total_pop"], errors='coerce').fillna(0) * merged["share_of_taluk_in_constituency"]

    # 7. AGGREGATE
    const_data = merged.groupby("constituency_name").agg({
        **{f"{rel}_w": "sum" for rel in religions}, 
        "total_pop_w": "sum"
    }).reset_index()

    # 8. LONG FORMAT
    long_df = const_data.melt(id_vars=["constituency_name", "total_pop_w"], value_vars=[f"{rel}_w" for rel in religions], var_name="religion", value_name="population")
    long_df["religion"] = long_df["religion"].str.replace("_w", "").str.capitalize()
    
    long_df["percent"] = 0.0
    mask = long_df["total_pop_w"] > 0
    long_df.loc[mask, "percent"] = (long_df.loc[mask, "population"] / long_df.loc[mask, "total_pop_w"]) * 100

    # 9. EXPORT
    final_output = long_df[["constituency_name", "religion", "population", "percent"]].copy()
    final_output.insert(1, "year", 2011)
    final_output.insert(2, "source", "Census 2011 (Proxy Matched)")
    
    final_output.to_csv(OUTPUT_PATH, index=False)
    print(f">>> SUCCESS: File saved to {OUTPUT_PATH} <<<")
if __name__ == "__main__":
    main()