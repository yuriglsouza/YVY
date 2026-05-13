import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'python-service'))
import satellite_analysis
import datetime
import ee
import json
from google.oauth2 import service_account

cred_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
if cred_json:
    creds_dict = json.loads(cred_json)
    creds = service_account.Credentials.from_service_account_info(creds_dict, scopes=['https://www.googleapis.com/auth/earthengine'])
    ee.Initialize(creds, project="syaz-487712")
else:
    ee.Initialize(project="syaz-487712")

# Coordinates of a typical farm (e.g. lat=-15, lon=-50 in Brazil)
lat = -15.5
lon = -55.5
size_ha = 100

point = ee.Geometry.Point([lon, lat])
import math
area_m2 = size_ha * 10000
radius_m = math.sqrt(area_m2 / math.pi)
roi = point.buffer(radius_m)

end_date = datetime.datetime.now()
start_date = end_date - datetime.timedelta(days=30)

print("Starting analysis...", file=sys.stderr)
satellite_analysis.analyze_farm(roi, start_date, end_date, size_ha)
