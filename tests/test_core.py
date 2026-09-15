import tempfile
import unittest
import os
from pathlib import Path

from site_infra.cli import _load_env_file
from site_infra.db import connect, facility_id, upsert_research, upsert_site
from site_infra.geo import haversine_m, point_in_geometry, to_web_mercator
from site_infra.map_qa import world_pixel
from site_infra.models import Accuracy, GeocodeResult, ResearchFacility
from site_infra.normalize import normalize_address


class CoreTests(unittest.TestCase):
    def test_load_env_does_not_override_existing_value(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_file = Path(tmp) / ".env"
            env_file.write_text("SITE_INFRA_TEST_KEY=file-value\n", encoding="utf-8")
            os.environ["SITE_INFRA_TEST_KEY"] = "process-value"
            try:
                _load_env_file(env_file)
                self.assertEqual(os.environ["SITE_INFRA_TEST_KEY"], "process-value")
            finally:
                os.environ.pop("SITE_INFRA_TEST_KEY", None)

    def test_address_normalization(self):
        self.assertEqual(
            normalize_address(" 서울특별시  마포구 성미산로29길 17-9 (연남동) "),
            "서울특별시 마포구 성미산로29길 17-9",
        )

    def test_distance_and_projection(self):
        self.assertLess(haversine_m(126.978, 37.5665, 126.978, 37.5666), 12)
        x, y = to_web_mercator(126.978, 37.5665)
        self.assertGreater(x, 14_000_000)
        self.assertGreater(y, 4_000_000)

    def test_world_pixel_origin(self):
        self.assertAlmostEqual(world_pixel(0, 0, 1)[0], 256)
        self.assertAlmostEqual(world_pixel(0, 0, 1)[1], 256)

    def test_polygon_with_hole(self):
        geometry = {
            "type": "Polygon",
            "coordinates": [
                [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
                [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
            ],
        }
        self.assertTrue(point_in_geometry(2, 2, geometry))
        self.assertFalse(point_in_geometry(5, 5, geometry))

    def test_upsert_is_reusable(self):
        with tempfile.TemporaryDirectory() as tmp:
            conn = connect(Path(tmp) / "test.sqlite3")
            try:
                item = ResearchFacility("시설", "public", "서울시 중구 세종대로 110")
                first = upsert_research(conn, item)
                second = upsert_research(conn, item)
                self.assertEqual(first, second)
                self.assertEqual(conn.execute("SELECT count(*) FROM facilities").fetchone()[0], 1)
                self.assertEqual(first, facility_id(item.name, item.address))
            finally:
                conn.close()

    def test_upsert_site(self):
        with tempfile.TemporaryDirectory() as tmp:
            conn = connect(Path(tmp) / "test.sqlite3")
            try:
                result = GeocodeResult(
                    normalized_address="서울특별시 송파구 법원로8길 8",
                    longitude=127.1,
                    latitude=37.4,
                    coordinate_source="test",
                    raw={},
                    pnu="123",
                )
                upsert_site(conn, result.normalized_address, result, Accuracy.PARCEL_VERIFIED, 2000, None)
                row = conn.execute("SELECT * FROM sites").fetchone()
                self.assertEqual(row["pnu"], "123")
                self.assertEqual(row["radius_m"], 2000)
            finally:
                conn.close()


if __name__ == "__main__":
    unittest.main()
