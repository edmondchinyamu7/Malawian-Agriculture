#!/usr/bin/env python3
"""Refresh Malawi market-level modeled food price estimates from the World Bank."""
import csv
import io
import json
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

DOWNLOAD_URL = "https://microdata.worldbank.org/api/downloads/MWI_2021_RTFP_v02_M/files?type=data"
SOURCE_URL = "https://microdata.worldbank.org/catalog/6171"
OUTPUT = Path("data/world-bank-market-estimates.json")

COMMODITIES = {
    "maize": ("Maize", "maize"),
    "beans": ("Beans", "beans"),
    "groundnuts": ("Groundnuts (shelled)", "groundnut"),
    "rice": ("Rice", "rice"),
    "cassava": ("Cassava", "cassava"),
}

def number(value):
    try:
        value = float(str(value).strip())
        return value if value > 0 else None
    except (TypeError, ValueError):
        return None

def main():
    request = urllib.request.Request(DOWNLOAD_URL, headers={"User-Agent": "Malawian-Agriculture-MarketCentre/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        archive_bytes = response.read()

    records = {}
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        csv_names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not csv_names:
            raise RuntimeError("World Bank download did not contain a CSV file.")

        for csv_name in csv_names:
            with archive.open(csv_name) as raw:
                text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
                reader = csv.DictReader(text)
                required = {"ISO3", "price_date", "currency", "mkt_name"}
                if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
                    continue

                for row in reader:
                    if row.get("ISO3", "").strip().upper() != "MWI":
                        continue
                    for ticker, (label, crop_key) in COMMODITIES.items():
                        close = number(row.get("c_" + ticker))
                        if close is None:
                            continue
                        date = (row.get("price_date") or "").strip()
                        market = (row.get("mkt_name") or row.get("adm2_name") or "Market not named").strip()
                        region = (row.get("adm1_name") or "Malawi").strip()
                        key = (market.lower(), ticker)
                        item = {
                            "id": "wb-" + str(row.get("geo_id", market)).replace(" ", "-") + "-" + ticker + "-" + date,
                            "crop": label,
                            "cropKey": crop_key,
                            "category": "Food crops",
                            "marketName": market,
                            "district": (row.get("adm2_name") or market).strip(),
                            "region": region,
                            "unit": "1 kg",
                            "priceMin": number(row.get("l_" + ticker)) or close,
                            "priceMax": number(row.get("h_" + ticker)) or close,
                            "priceEstimate": close,
                            "currency": row.get("currency") or "MWK",
                            "dateReported": date,
                            "status": "estimated",
                            "reporter": "World Bank Development Data Group",
                            "sourceName": "World Bank Real Time Food Prices (RTFP)",
                            "sourceUrl": SOURCE_URL,
                            "priceBasis": "Modeled monthly closing estimate per kg",
                            "isInterpolated": str(row.get("spatially_interpolated", "")).strip() in ("1", "true", "True"),
                            "notes": "Modeled monthly estimate based on available price observations and statistical estimation. It is not a live market offer or a confirmed transaction price."
                        }
                        previous = records.get(key)
                        if previous is None or date > previous["dateReported"]:
                            records[key] = item

    output = sorted(records.values(), key=lambda item: (item["dateReported"], item["crop"], item["marketName"]), reverse=True)
    if not output:
        raise RuntimeError("No Malawi commodity estimates were found. Existing published data was not overwritten.")

    payload = {
        "source": "World Bank Real Time Food Prices (RTFP)",
        "sourceUrl": SOURCE_URL,
        "datasetUpdatedAt": datetime.now(timezone.utc).isoformat(),
        "recordCount": len(output),
        "data": output
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(output)} latest market/commodity estimates to {OUTPUT}")

if __name__ == "__main__":
    main()
