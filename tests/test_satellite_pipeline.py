"""Offline regression tests: external Earth Engine and HTTP services are mocked."""
import ast
import base64
import datetime
import importlib.util
import math
import os
from pathlib import Path
import sys
from threading import Barrier
from types import SimpleNamespace
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
ee = MagicMock()
requests = MagicMock()
spec = importlib.util.spec_from_file_location('satellite_under_test', ROOT / 'python-service/satellite_analysis.py')
satellite = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {'ee': ee, 'requests': requests}):
    spec.loader.exec_module(satellite)


class ThumbnailTests(unittest.TestCase):
    def response(self, content=b'image', status=200):
        return MagicMock(status_code=status, content=content, headers={'content-type': 'image/jpeg'})

    def test_downloads_overlap_and_preserve_order(self):
        barrier = Barrier(2)
        responses = []
        def get(url, timeout):
            self.assertEqual(timeout, 60)
            barrier.wait(timeout=2)  # Sequential downloads cannot pass this test.
            response = self.response(url.encode())
            responses.append(response)
            return response
        with patch.object(requests, 'get', side_effect=get):
            rgb, thermal = satellite.download_thumbnails('rgb', 'thermal')
        self.assertEqual(rgb, (base64.b64encode(b'rgb').decode(), 'image/jpeg'))
        self.assertEqual(thermal, (base64.b64encode(b'thermal').decode(), 'image/jpeg'))
        for response in responses:
            response.close.assert_called_once()

    def test_missing_urls_do_not_request_anything(self):
        with patch.object(requests, 'get') as get:
            self.assertEqual(satellite.download_thumbnails(None, None), ((None, None), (None, None)))
            get.assert_not_called()

    def test_failure_of_one_image_preserves_the_other(self):
        def get(url, timeout):
            if url == 'rgb':
                raise TimeoutError('test timeout')
            return self.response()
        with patch.object(requests, 'get', side_effect=get):
            rgb, thermal = satellite.download_thumbnails('rgb', 'thermal')
        self.assertEqual(rgb, (None, None))
        self.assertIsNotNone(thermal[0])

    def test_empty_and_http_error_responses_are_closed(self):
        for response in (self.response(b''), self.response(status=503)):
            with patch.object(requests, 'get', return_value=response):
                self.assertEqual(satellite.download_thumbnail('url', 'RGB'), (None, None))
            response.close.assert_called_once()


class AnalysisTests(unittest.TestCase):
    def setUp(self):
        ee.reset_mock(return_value=True, side_effect=True)
        self.roi = MagicMock()
        self.roi.buffer.return_value.bounds.return_value.getInfo.return_value = {
            'coordinates': [[[-54, -28], [-53, -28], [-53, -27], [-54, -27]]]}
        self.roi.area.return_value.divide.return_value.getInfo.return_value = 10
        self.ndvi, self.ndwi, self.ndre, self.composite, self.rvi, self.lst = [MagicMock() for _ in range(6)]
        self.ndvi.reduceRegion.return_value.getInfo.return_value = {'ndvi': .6}
        self.rvi.reduceRegion.return_value.getInfo.return_value = {'rvi': .5}
        self.lst.reduceRegion.return_value.getInfo.return_value = {'lst': 25}
        ee.Image.return_value.reduceRegion.return_value.getInfo.return_value = {
            'ndvi': .7, 'ndwi': .2, 'ndre': .3, 'otci': 1.1}
        ee.ImageCollection.return_value.filterDate.return_value.filterBounds.return_value.aggregate_mean.return_value.getInfo.return_value = 20
        self.composite.select.return_value.visualize.return_value.getThumbURL.return_value = 'rgb'
        self.lst.visualize.return_value.getThumbURL.return_value = 'thermal'

    def run_analysis(self):
        with patch.object(satellite, 'get_sentinel2_indices', return_value=(self.ndvi, self.ndwi, self.ndre, self.composite)) as s2, \
             patch.object(satellite, 'get_sentinel1_indices', return_value=self.rvi), \
             patch.object(satellite, 'get_landsat_lst', return_value=(self.lst, None)), \
             patch.object(satellite, 'download_thumbnails', return_value=(('rgb64', 'image/png'), ('thermal64', 'image/jpeg'))):
            result = satellite.analyze_farm(self.roi, '2026-08-27', '2026-09-26', 10)
        s2.assert_called_once()  # No unused previous-month satellite computation.
        return result

    def test_preserves_complete_reading_contract(self):
        result = self.run_analysis()
        self.assertEqual(result, {
            'date': '2026-09-26', 'ndvi': .7, 'ndwi': .2, 'ndre': .3, 'rvi': .5,
            'temperature': 25, 'otci': 1.1, 'cloud_cover': .2,
            'satellite_image_base64': 'rgb64', 'satellite_image_content_type': 'image/png',
            'thermal_image_base64': 'thermal64', 'thermal_image_content_type': 'image/jpeg',
            'bounds': [[-28, -54], [-27, -53]], 'regional_ndvi': .6,
            'carbon_stock': (180 * .7 - 40) * 10 * .47,
            'co2_equivalent': (180 * .7 - 40) * 10 * .47 * 3.67})
        self.assertEqual(ee.Image.return_value.reduceRegion.call_args.kwargs['scale'], 10)
        self.assertEqual(self.lst.reduceRegion.call_args.kwargs['scale'], 100)

    def test_rgb_thumbnail_generation_failure_does_not_lose_reading(self):
        self.composite.select.return_value.visualize.return_value.getThumbURL.side_effect = RuntimeError('test RGB failure')
        self.assertEqual(self.run_analysis()['ndvi'], .7)

    def test_analysis_failure_returns_error_dict(self):
        with patch.object(satellite, 'get_sentinel2_indices', side_effect=RuntimeError('EE offline')):
            self.assertEqual(satellite.analyze_farm(self.roi, '2026-08-27', '2026-09-26', 10), {'error': 'EE offline'})

    def test_fallback_window_is_90_days_including_leap_year(self):
        collection = ee.ImageCollection.return_value
        collection.filterDate.return_value.filterBounds.return_value.filter.return_value.size.return_value.getInfo.return_value = 0
        satellite.get_sentinel2_indices(self.roi, '2024-03-01', '2024-03-31')
        self.assertEqual(collection.filterDate.call_args_list[1].args, ('2024-01-01', '2024-03-31'))
        ee.Date.assert_not_called()


class EndpointTests(unittest.TestCase):
    def setUp(self):
        # Execute the real endpoint function without loading unrelated ML dependencies.
        tree = ast.parse((ROOT / 'python-service/app.py').read_text(encoding='utf-8'))
        function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'analyze_satellite')
        function.decorator_list = []
        self.analysis = MagicMock()
        namespace = {'SatelliteRequest': object, 'ee': ee, 'math': math,
                     'datetime': datetime, 'satellite_analysis': self.analysis}
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'app.py', 'exec'), namespace)
        self.endpoint = namespace['analyze_satellite']

    def test_polygon_and_backfill_window_preserved(self):
        polygon = [[1, 2], [3, 4], [5, 6]]
        result = self.endpoint(SimpleNamespace(polygon=polygon, date='2026-09-15', size=10))
        self.assertIs(result, self.analysis.analyze_farm.return_value)
        self.assertEqual(self.analysis.analyze_farm.call_args.args[1:], ('2026-08-31', '2026-09-30', 10))
        ee.Geometry.Polygon.assert_called_with([polygon])

    def test_default_circle_and_invalid_date_preserved(self):
        before = datetime.datetime.now().strftime('%Y-%m-%d')
        self.endpoint(SimpleNamespace(polygon=None, lat=-27, lon=-53, date='invalid', size=10))
        args = self.analysis.analyze_farm.call_args.args
        self.assertEqual(args[2], before)
        self.assertEqual((datetime.date.fromisoformat(args[2]) - datetime.date.fromisoformat(args[1])).days, 30)
        ee.Geometry.Point.assert_called_with([-53, -27])
        self.assertAlmostEqual(ee.Geometry.Point.return_value.buffer.call_args.args[0], math.sqrt(100000 / math.pi))

    def test_concurrent_requests_keep_their_own_results(self):
        barrier = Barrier(2)
        def analyze(roi, start, end, size):
            barrier.wait(timeout=2)
            return {'ndvi': size / 100, 'date': end}
        self.analysis.analyze_farm.side_effect = analyze
        original_stdout = sys.stdout
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.endpoint, SimpleNamespace(
                polygon=None, lat=-27, lon=-53, date='2026-09-15', size=size)) for size in (10, 20)]
            self.assertEqual([f.result()['ndvi'] for f in futures], [.1, .2])
        self.assertIs(sys.stdout, original_stdout)


class WarmupTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse((ROOT / 'python-service/app.py').read_text(encoding='utf-8'))
        function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'ensure_earth_engine_ready')
        self.ee = MagicMock()
        self.analysis = MagicMock()
        self.namespace = {'earth_engine_ready': False, 'ee': self.ee,
                          'satellite_analysis': self.analysis}
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'app.py', 'exec'), self.namespace)
        self.warmup = self.namespace['ensure_earth_engine_ready']
        google = MagicMock()
        self.modules = patch.dict(sys.modules, {'google': google, 'google.oauth2': google.oauth2})
        self.modules.start()
        self.addCleanup(self.modules.stop)
        env = patch.dict(os.environ, {'GOOGLE_APPLICATION_CREDENTIALS_JSON': ''})
        env.start()
        self.addCleanup(env.stop)

    def test_initializes_once_but_checks_health_every_time(self):
        for _ in range(3):
            self.assertEqual(self.warmup(), {'ready': True, 'error': None})
        self.analysis.init_earth_engine.assert_called_once()
        self.assertEqual(self.ee.Number.return_value.getInfo.call_count, 3)

    def test_recovers_when_existing_client_fails(self):
        self.namespace['earth_engine_ready'] = True
        self.ee.Number.return_value.getInfo.side_effect = [RuntimeError('expired'), 1]
        self.assertTrue(self.warmup()['ready'])
        self.analysis.init_earth_engine.assert_called_once()

    def test_failed_recovery_reports_not_ready(self):
        self.namespace['earth_engine_ready'] = True
        self.ee.Number.return_value.getInfo.side_effect = RuntimeError('offline')
        self.assertFalse(self.warmup()['ready'])
        self.assertFalse(self.namespace['earth_engine_ready'])
        self.analysis.init_earth_engine.assert_called_once()


if __name__ == '__main__':
    unittest.main()
