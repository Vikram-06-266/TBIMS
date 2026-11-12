
import pandas as pd
from pathlib import Path

folder = Path(__file__).parent

input_file = folder / "Online Retail.xlsx"
output_file = folder / "online_retail_staging.csv"

print("Reading original UCI dataset...")

df = pd.read_excel(input_file, engine="openpyxl")

# Keep only the original eight columns in their original order
columns = [
    "InvoiceNo",
    "StockCode",
    "Description",
    "Quantity",
    "InvoiceDate",
    "UnitPrice",
    "CustomerID",
    "Country"
]

df = df[columns].copy()

# Convert invoice and stock codes to text
df["InvoiceNo"] = df["InvoiceNo"].astype(str)
df["StockCode"] = df["StockCode"].astype(str)

# Preserve missing descriptions and customer IDs as empty fields
df["Description"] = df["Description"].fillna("")
df["CustomerID"] = df["CustomerID"].apply(
    lambda x: "" if pd.isna(x) else str(int(x))
)

# Convert numeric and date fields to text for staging
df["Quantity"] = df["Quantity"].astype(str)
df["UnitPrice"] = df["UnitPrice"].astype(str)

df["InvoiceDate"] = pd.to_datetime(
    df["InvoiceDate"]
).dt.strftime("%Y-%m-%d %H:%M:%S")

df["Country"] = df["Country"].astype(str)

# Export without changing the original record count
df.to_csv(
    output_file,
    index=False,
    encoding="utf-8",
    na_rep=""
)

print("CSV preparation completed!")
print("Total records:", len(df))
print("Output file:", output_file)
