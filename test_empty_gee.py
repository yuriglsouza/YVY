import ee
import os
import requests
import json
from google.oauth2 import service_account

cred_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
if cred_json:
    creds_dict = json.loads(cred_json)
    creds = service_account.Credentials.from_service_account_info(creds_dict, scopes=['https://www.googleapis.com/auth/earthengine'])
    ee.Initialize(creds, project="syaz-487712")
else:
    ee.Initialize(project="syaz-487712")

# Create a completely masked image
empty_img = ee.Image(0).updateMask(0)
url = empty_img.getThumbURL({'dimensions': 100, 'format': 'png'})
print("URL:", url)

r = requests.get(url)
print("Status:", r.status_code)
print("Response:", r.text[:200])
