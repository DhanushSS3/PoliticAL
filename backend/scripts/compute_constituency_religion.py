import pandas as pd
from pathlib import Path

BASE = Path(r"C:\Users\user\movies\PoliticAI")

CENSUS_PATH = BASE / "DDW29C-01 MDDS.XLS"
MAPPING_PATH = BASE / "Constituency_Taluk_Mapping (1).xlsx"
OUTPUT_PATH = BASE / "constituency_religion.csv"

YEAR = 2011
SOURCE = "Census 2011 (taluk-weighted)"


def find_col(df: pd.DataFrame, *tokens: str) -> str:
    """
    Find first column whose header contains ALL tokens (case-insensitive).
    Raises if not found, so you notice quickly.
    """
    tokens = [t.lower() for t in tokens]
    for col in df.columns:
        text = str(col).lower()
        if all(t in text for t in tokens):
            return col
    raise KeyError(f"Could not find column with tokens {tokens}")


def normalize_name(s: str) -> str:
    if pd.isna(s):
        return ""
    s = str(s).strip().lower()
    # remove common suffixes
    for token in [" taluk", " taluka", " tq", " tq.", " talq", " tal"]:
        if s.endswith(token):
            s = s[: -len(token)]
    # collapse multiple spaces
    s = " ".join(s.split())
    return s


def main():
    # 1) Read census file
    census = pd.read_excel(CENSUS_PATH)

    # 2) Identify key columns by pattern
    level_col = find_col(census, "level")               # e.g. "Level"
    tru_col = find_col(census, "tru")                   # Total / Rural / Urban
    state_code_col = find_col(census, "state", "code")  # "State Code"
    district_name_col = find_col(census, "district", "name")
    taluk_name_col = find_col(census, "sub-district", "name")

    # Religion columns (Persons only)
    religion_cols = {
        "HINDU":      find_col(census, "hindus", "persons"),
        "MUSLIM":     find_col(census, "muslims", "persons"),
        "CHRISTIAN":  find_col(census, "christians", "persons"),
        "SIKH":       find_col(census, "sikhs", "persons"),
        "BUDDHIST":   find_col(census, "buddhists", "persons"),
        "JAIN":       find_col(census, "jains", "persons"),
        "OTHER":      find_col(census, "other religions", "persons"),
        "NOT_STATED": find_col(census, "religion not stated", "persons"),
    }

    # 3) Keep only Sub-District rows as taluks and only TOTAL (not rural/urban splits)
    is_subdistrict = census[level_col].astype(str).str.contains(
        "sub-district", case=False, na=False
    )
    is_total_tru = census[tru_col].astype(str).str.startswith(
        ("t", "T", "total"), na=False
    )

    taluks = census[is_subdistrict & is_total_tru].copy()

    # 4) Normalize keys in census
    taluks["state_code"] = taluks[state_code_col].astype(int)
    taluks["district_name_norm"] = taluks[district_name_col].apply(normalize_name)
    taluks["taluk_name_norm"] = taluks[taluk_name_col].apply(normalize_name)

    # 5) Read and normalize mapping file
    mapping = pd.read_excel(MAPPING_PATH)

    mapping["state_code"] = mapping["state_code"].astype(int)
    mapping["district_name_norm"] = mapping["district_name"].apply(normalize_name)
    mapping["taluk_name_norm"] = mapping["taluk_name"].apply(normalize_name)

    # 6) Inner join: only taluks that are mapped to constituencies
    merged = pd.merge(
        taluks,
        mapping,
        how="inner",
        on=["state_code", "district_name_norm", "taluk_name_norm"],
        suffixes=("_census", "_map"),
    )

    # Optional: show taluks in census that did NOT match mapping
    missing = taluks.merge(
        mapping[["state_code", "district_name_norm", "taluk_name_norm"]],
        how="left",
        on=["state_code", "district_name_norm", "taluk_name_norm"],
        indicator=True,
    )
    missing = missing[missing["_merge"] == "left_only"]
    if not missing.empty:
        print("WARNING: some taluks in census are not in the mapping file. Top 20:")
        print(
            missing[
                [state_code_col, district_name_col, taluk_name_col]
            ].drop_duplicates().head(20)
        )

    # 7) Allocate religion counts from taluks to constituencies
    for rel, col in religion_cols.items():
        merged[col] = pd.to_numeric(merged[col], errors="coerce").fillna(0)
        merged[f"{rel}_alloc"] = merged[col] * merged["share_of_taluk_in_constituency"]

    # 8) Aggregate by constituency
    alloc_cols = [f"{rel}_alloc" for rel in religion_cols.keys()]
    group_cols = ["state_code", "district_name", "constituency_name"]

    agg = (
        merged.groupby(group_cols, dropna=False)[alloc_cols]
        .sum()
        .reset_index()
    )

    # 9) Total population and percents
    agg["total_population"] = agg[alloc_cols].sum(axis=1)

    for rel in religion_cols.keys():
        agg[f"{rel}_percent"] = 100.0 * agg[f"{rel}_alloc"] / agg["total_population"]

    # 10) Long format for import
    records = []
    for rel in religion_cols.keys():
        tmp = agg[["state_code", "district_name", "constituency_name"]].copy()
        tmp["year"] = YEAR
        tmp["source"] = SOURCE
        tmp["religion"] = rel
        tmp["population"] = agg[f"{rel}_alloc"].round().astype(int)
        tmp["percent"] = agg[f"{rel}_percent"]
        records.append(tmp)

    final = pd.concat(records, ignore_index=True)

    final.to_csv(OUTPUT_PATH, index=False, encoding="utf-8")
    print(f"Written {len(final)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()