
import pandas as pd
from pathlib import Path

file_path = Path(__file__).parent / "Online Retail.xlsx"

print("Reading UCI Online Retail dataset...")

df = pd.read_excel(file_path, engine="openpyxl")

print("\n========== DATASET REPORT ==========")

print("\n1. Total records:")
print(len(df))

print("\n2. Column names:")
print(df.columns.tolist())

print("\n3. First 5 records:")
print(df.head())

print("\n4. Date range:")
dates = pd.to_datetime(df["InvoiceDate"], errors="coerce")
print("Earliest:", dates.min())
print("Latest:", dates.max())

print("\n5. Missing values:")
print(df.isnull().sum())

print("\n6. Negative quantity records:")
print((df["Quantity"] < 0).sum())

print("\n7. Cancellation invoices:")
invoice_numbers = df["InvoiceNo"].astype(str)
print(invoice_numbers.str.startswith("C").sum())

print("\n8. Unique products:")
print(df["StockCode"].nunique())

print("\n9. Unique invoices:")
print(df["InvoiceNo"].nunique())

print("\n10. Unique customers:")
print(df["CustomerID"].nunique())

print("\n11. Unique countries:")
print(df["Country"].nunique())

print("\n========== INSPECTION COMPLETED ==========")
