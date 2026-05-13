import ee
import json
import requests
from google.oauth2 import service_account
import os

with open('/Users/yuri/Downloads/syaz-487712-1537cc7ef623.json', 'r') as f:
    creds_dict = json.load(f)

creds = service_account.Credentials.from_service_account_info(creds_dict, scopes=['https://www.googleapis.com/auth/earthengine'])
ee.Initialize(creds, project="syaz-487712")

img = ee.Image(0).updateMask(0)
url = img.getThumbURL({'dimensions': 100, 'format': 'png'})
print("Generated URL:", url)

r = requests.get(url)
print("Status:", r.status_code)
if r.status_code != 200:
    print("Response:", r.text[:200])
